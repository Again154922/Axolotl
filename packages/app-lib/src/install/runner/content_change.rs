use super::*;
use futures::{StreamExt, stream};
use std::collections::{HashMap, HashSet};
use std::time::Duration;

pub(super) async fn run(
    job_id: Uuid,
    job_state: &mut InstallJobState,
    instance_id: &str,
    intent: &crate::install::ContentChangeIntent,
) -> crate::Result<()> {
    let state = State::get().await?;
    let reporter = InstallProgressReporter::new(job_id, job_state.clone());
    let cancellation = reporter.cancellation_token();
    let mut actions = cancelable(
        &cancellation,
        load_or_resolve_actions(job_state, instance_id, intent, &reporter),
    )
    .await?;
    cancelable(
        &cancellation,
        prepare_actions(
            job_state,
            instance_id,
            &mut actions,
            &reporter,
            &state,
            &cancellation,
        ),
    )
    .await?;

    download_prepared_files(
        job_state,
        instance_id,
        &mut actions,
        &reporter,
        &state,
        &cancellation,
    )
    .await?;
    publish_actions(
        job_state,
        instance_id,
        &mut actions,
        &reporter,
        &cancellation,
    )
    .await?;

    let failures = actions
        .iter()
        .filter(|action| {
            action.effective_status()
                == crate::install::ContentChangeActionStatus::Failed
        })
        .count();
    if failures > 0 {
        return Err(crate::ErrorKind::OtherError(format!(
            "{failures} content change(s) failed"
        ))
        .into());
    }
    Ok(())
}

async fn prepare_actions(
    job_state: &mut InstallJobState,
    instance_id: &str,
    actions: &mut [crate::install::ContentChangeAction],
    reporter: &InstallProgressReporter,
    state: &std::sync::Arc<State>,
    cancellation: &tokio_util::sync::CancellationToken,
) -> crate::Result<()> {
    let pending = actions
        .iter()
        .filter(|action| {
            !action.is_complete()
                && action.effective_status()
                    != crate::install::ContentChangeActionStatus::Downloaded
        })
        .count() as u64;
    reporter
        .update(
            InstallPhaseId::StagingContent,
            Some(InstallProgress {
                current: 0,
                total: pending.max(1),
                secondary: None,
            }),
            InstallPhaseDetails::Empty,
        )
        .await?;

    let concurrency = state.download_concurrency().max(1);
    let mut completed = 0_u64;
    {
        let pending_actions = actions
            .iter()
            .enumerate()
            .filter(|(_, action)| {
                !action.is_complete()
                    && action.effective_status()
                        != crate::install::ContentChangeActionStatus::Downloaded
            })
            .map(|(index, action)| (index, action.clone()))
            .collect::<Vec<_>>();
        let mut preparations = stream::iter(pending_actions.into_iter().map(
            |(index, mut action)| {
                let cancellation = cancellation.clone();
                let instance_id = instance_id.to_string();
                let state = state.clone();
                async move {
                    check_canceled(&cancellation)?;
                    action.set_status(
                        crate::install::ContentChangeActionStatus::Pending,
                    );
                    let result = match action.provider {
                        ContentProvider::Modrinth => {
                            crate::state::instances::commands::prepare_modrinth_content_change_action(
                                &instance_id,
                                &mut action,
                                &state,
                            )
                            .await
                        }
                        ContentProvider::CurseForge => {
                            crate::api::curseforge::prepare_curseforge_content_change_action(
                                &instance_id,
                                &mut action,
                            )
                            .await
                        }
                        provider => Err(crate::ErrorKind::InputError(format!(
                            "Provider {} does not support content changes",
                            provider.as_str()
                        ))
                        .into()),
                    };
                    if let Err(error) = result {
                        action.status =
                            crate::install::ContentChangeActionStatus::Failed;
                        action.error = Some(error.to_string());
                    }
                    Ok::<_, crate::Error>((index, action))
                }
            },
        ))
        .buffer_unordered(concurrency);

        while let Some(result) = preparations.next().await {
            let (index, action) = result?;
            actions[index] = action;
            completed += 1;
            reporter
                .update(
                    InstallPhaseId::StagingContent,
                    Some(InstallProgress {
                        current: completed,
                        total: pending.max(1),
                        secondary: None,
                    }),
                    InstallPhaseDetails::Empty,
                )
                .await?;
        }
    }
    check_canceled(cancellation)?;
    persist_actions(job_state, reporter, actions).await
}

async fn load_or_resolve_actions(
    job_state: &mut InstallJobState,
    instance_id: &str,
    intent: &crate::install::ContentChangeIntent,
    reporter: &InstallProgressReporter,
) -> crate::Result<Vec<crate::install::ContentChangeAction>> {
    let mut actions = match job_state.continuation.clone() {
        Some(InstallContinuationState::ChangeContent {
            version,
            mut actions,
        }) => {
            let switched_content_id = match intent {
                crate::install::ContentChangeIntent::SwitchVersion {
                    content_id,
                    ..
                } => Some(content_id.as_str()),
                _ => None,
            };
            for action in &mut actions {
                if version < crate::install::CONTENT_CHANGE_PLAN_VERSION {
                    action.operation = if switched_content_id
                        == Some(action.content_id.as_str())
                    {
                        crate::install::ContentChangeOperation::SwitchVersion
                    } else {
                        crate::install::ContentChangeOperation::Update
                    };
                }
                action.status = action.effective_status();
                if action.status
                    == crate::install::ContentChangeActionStatus::Failed
                {
                    action.set_status(
                        crate::install::ContentChangeActionStatus::Pending,
                    );
                }
            }
            actions
        }
        _ => {
            crate::api::instance::resolve_content_change_actions(
                instance_id,
                intent,
            )
            .await?
        }
    };
    for action in &mut actions {
        if action.final_relative_path.is_none() {
            action.final_relative_path = action.relative_path.clone();
        }
    }
    persist_actions(job_state, reporter, &actions).await?;
    Ok(actions)
}

async fn download_prepared_files(
    job_state: &mut InstallJobState,
    instance_id: &str,
    actions: &mut [crate::install::ContentChangeAction],
    reporter: &InstallProgressReporter,
    state: &State,
    cancellation: &tokio_util::sync::CancellationToken,
) -> crate::Result<()> {
    let files = unique_pending_files(actions);
    if files.is_empty() {
        return Ok(());
    }
    let total_bytes = files
        .iter()
        .map(|file| file.integrity.size)
        .collect::<Option<Vec<_>>>()
        .map(|sizes| sizes.into_iter().sum::<u64>());
    let mut events = Vec::with_capacity(files.len() + 1);
    events.push(InstallJobEventKind::ContentDownloadStarted {
        files: files.len() as u64,
        bytes: total_bytes,
    });
    for file in &files {
        events.push(InstallJobEventKind::ContentFileQueued {
            path: file.target_relative_path.clone(),
            bytes_total: file.integrity.size,
            max_attempts: 5,
        });
        if !file.urls.is_empty() {
            events.push(InstallJobEventKind::ContentFileBrowserOptions {
                path: file.target_relative_path.clone(),
                urls: file.urls.clone(),
            });
        }
    }
    reporter
        .update(
            InstallPhaseId::DownloadingContent,
            Some(InstallProgress {
                current: 0,
                total: total_bytes.unwrap_or(files.len() as u64).max(1),
                secondary: None,
            }),
            InstallPhaseDetails::Empty,
        )
        .await?;
    reporter.record_events(events).await?;

    let worker_reporter = reporter.clone().without_phase_updates();
    let concurrency = state.download_concurrency().max(1);
    let mut downloads = stream::iter(files.into_iter().map(|file| {
        let reporter = worker_reporter.clone();
        let instance_id = instance_id.to_string();
        async move {
            if file.manual_download_url.is_some() && file.urls.is_empty() {
                return (
                    file,
                    Err(crate::Error::from(crate::ErrorKind::InputError(
                        "This content file requires a manual download"
                            .to_string(),
                    ))),
                );
            }
            let result = match file.provider {
				ContentProvider::Modrinth => {
					crate::state::instances::commands::download_project_version_with_reporter(
						&instance_id,
						&file.release_id,
						if file.role == crate::install::ContentChangeFileRole::Primary {
							DownloadReason::Update
						} else {
							DownloadReason::Dependency
						},
						None,
						reporter,
						state,
					)
					.await
					.map(|_| ())
				}
				ContentProvider::CurseForge => {
					match (
						file.project_id.parse::<u32>(),
						file.release_id.parse::<u32>(),
					) {
						(Ok(project_id), Ok(file_id)) => {
							crate::api::curseforge::stage_curseforge_upgrade_file(
								project_id,
								file_id,
								None,
								Some(&reporter),
							)
							.await
							.map(|_| ())
						}
						_ => Err(crate::ErrorKind::InputError(
							"Invalid CurseForge project or file ID".to_string(),
						)
						.into()),
					}
				}
				provider => Err(crate::ErrorKind::InputError(format!(
					"Provider {} cannot be downloaded automatically",
					provider.as_str()
				))
				.into()),
			};
            (file, result)
        }
    }))
    .buffer_unordered(concurrency);
    let progress = async {
        let mut ticker = tokio::time::interval(Duration::from_millis(150));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            ticker.tick().await;
            let current = reporter.current_state().await?;
            let summary = current.download_summary();
            let (current, total) = match total_bytes {
                Some(total) => {
                    (summary.bytes_downloaded.min(total), total.max(1))
                }
                None => (
                    summary.files_completed,
                    summary.files_total.unwrap_or_default().max(1),
                ),
            };
            reporter
                .update(
                    InstallPhaseId::DownloadingContent,
                    Some(InstallProgress {
                        current,
                        total,
                        secondary: None,
                    }),
                    InstallPhaseDetails::Empty,
                )
                .await?;
        }
    };
    let download = async {
        let mut failed_files = HashSet::new();
        while let Some((file, result)) = downloads.next().await {
            match result {
                Ok(()) => {
                    reporter
                        .record_events(vec![
                            InstallJobEventKind::ContentFileCompleted {
                                path: file.target_relative_path,
                                bytes: file.integrity.size.unwrap_or_default(),
                            },
                        ])
                        .await?;
                }
                Err(error) => {
                    failed_files.insert(file.id.clone());
                    reporter
                        .record_events(vec![
                            InstallJobEventKind::ContentFileFailed {
                                path: file.target_relative_path,
                                reason: error.to_string(),
                                project_id: Some(file.project_id),
                                version_id: Some(file.release_id),
                            },
                        ])
                        .await?;
                }
            }
        }
        Ok(failed_files)
    };
    let failed_files =
        drive_downloads(cancellation, download, progress).await?;
    for action in actions.iter_mut().filter(|action| !action.is_complete()) {
        if action.effective_status()
            == crate::install::ContentChangeActionStatus::Failed
        {
            continue;
        }
        if action
            .files
            .iter()
            .any(|file| failed_files.contains(&file.id))
        {
            action.status = crate::install::ContentChangeActionStatus::Failed;
            action.error = Some(
                "One or more content files could not be downloaded".to_string(),
            );
        } else {
            action.set_status(
                crate::install::ContentChangeActionStatus::Downloaded,
            );
        }
    }
    persist_actions(job_state, reporter, actions).await
}

async fn publish_actions(
    job_state: &mut InstallJobState,
    instance_id: &str,
    actions: &mut [crate::install::ContentChangeAction],
    reporter: &InstallProgressReporter,
    cancellation: &tokio_util::sync::CancellationToken,
) -> crate::Result<()> {
    let total = actions.len() as u64;
    for index in 0..actions.len() {
        if actions[index].is_complete()
            || actions[index].effective_status()
                == crate::install::ContentChangeActionStatus::Failed
        {
            continue;
        }
        check_canceled(cancellation)?;
        reporter
            .update(
                InstallPhaseId::ApplyingContent,
                Some(InstallProgress {
                    current: index as u64,
                    total: total.max(1),
                    secondary: None,
                }),
                InstallPhaseDetails::Empty,
            )
            .await?;
        let current = crate::api::instance::projects::content_mutation_target(
            instance_id,
            &actions[index].content_id,
        )
        .await;
        check_canceled(cancellation)?;
        let result = match current {
            Ok(current)
                if current.provider_release_id.as_deref()
                    == Some(actions[index].target_release_id.as_str()) =>
            {
                actions[index].set_status(
                    crate::install::ContentChangeActionStatus::Skipped,
                );
                Ok(())
            }
            Ok(current)
                if current.provider == Some(actions[index].provider)
                    && current.provider_release_id
                        == actions[index].expected_release_id =>
            {
                actions[index].set_status(
                    crate::install::ContentChangeActionStatus::Applying,
                );
                persist_actions(job_state, reporter, actions).await?;
                check_canceled(cancellation)?;
                crate::api::instance::projects::switch_content_entry_version(
                    instance_id,
                    &actions[index].content_id,
                    &actions[index].target_release_id,
                    None,
                )
                .await
                .map(|_| ())
            }
            Ok(_) => Err(crate::ErrorKind::InputError(format!(
                "Content {} changed after the task was queued",
                actions[index].content_id
            ))
            .into()),
            Err(error) => Err(error),
        };
        match result {
            Ok(()) => {
                if !actions[index].is_complete() {
                    actions[index].set_status(
                        crate::install::ContentChangeActionStatus::Completed,
                    );
                }
            }
            Err(error) => {
                actions[index].status =
                    crate::install::ContentChangeActionStatus::Failed;
                actions[index].error = Some(error.to_string());
            }
        }
        persist_actions(job_state, reporter, actions).await?;
    }
    Ok(())
}

async fn persist_actions(
    job_state: &mut InstallJobState,
    reporter: &InstallProgressReporter,
    actions: &[crate::install::ContentChangeAction],
) -> crate::Result<()> {
    let continuation = InstallContinuationState::ChangeContent {
        version: crate::install::CONTENT_CHANGE_PLAN_VERSION,
        actions: actions.to_vec(),
    };
    job_state.continuation = Some(continuation.clone());
    reporter.set_continuation(Some(continuation)).await
}

fn check_canceled(
    cancellation: &tokio_util::sync::CancellationToken,
) -> crate::Result<()> {
    if cancellation.is_cancelled() {
        return Err(crate::ErrorKind::InputError(
            "Content change canceled".to_string(),
        )
        .into());
    }
    Ok(())
}

async fn cancelable<T>(
    cancellation: &tokio_util::sync::CancellationToken,
    work: impl std::future::Future<Output = crate::Result<T>>,
) -> crate::Result<T> {
    tokio::select! {
        biased;
        _ = cancellation.cancelled() => {
            Err(crate::ErrorKind::InputError("Content change canceled".to_string()).into())
        }
        result = work => result,
    }
}

// Keep polling the download workers while progress waits for their reporter lock.
async fn drive_downloads<T>(
    cancellation: &tokio_util::sync::CancellationToken,
    downloads: impl std::future::Future<Output = crate::Result<T>>,
    progress: impl std::future::Future<Output = crate::Result<()>>,
) -> crate::Result<T> {
    cancelable(cancellation, async {
        tokio::pin!(downloads);
        tokio::select! {
            result = &mut downloads => result,
            result = progress => {
                result?;
                downloads.await
            }
        }
    })
    .await
}

fn unique_pending_files(
    actions: &[crate::install::ContentChangeAction],
) -> Vec<crate::install::ContentChangeFile> {
    let mut files = HashMap::new();
    for action in actions.iter().filter(|action| !action.is_complete()) {
        if action.effective_status()
            == crate::install::ContentChangeActionStatus::Failed
        {
            continue;
        }
        for file in &action.files {
            files.entry(file.id.clone()).or_insert_with(|| file.clone());
        }
    }
    let mut files = files.into_values().collect::<Vec<_>>();
    files.sort_by(|left, right| left.id.cmp(&right.id));
    files
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::install::{
        ContentChangeAction, ContentChangeActionStatus, ContentChangeFile,
        ContentChangeFileIntegrity, ContentChangeFileRole,
        ContentChangeOperation,
    };

    #[tokio::test]
    async fn progress_wait_does_not_stop_polling_download_workers() {
        let lock = tokio::sync::Mutex::new(());
        let (locked_tx, locked_rx) = tokio::sync::oneshot::channel();
        let (sampling_tx, sampling_rx) = tokio::sync::oneshot::channel();
        let downloads = async {
            let _guard = lock.lock().await;
            locked_tx.send(()).unwrap();
            sampling_rx.await.unwrap();
            tokio::task::yield_now().await;
            Ok(42)
        };
        let progress = async {
            locked_rx.await.unwrap();
            sampling_tx.send(()).unwrap();
            let _guard = lock.lock().await;
            Ok(())
        };
        let result = tokio::time::timeout(
            Duration::from_secs(1),
            drive_downloads(
                &tokio_util::sync::CancellationToken::new(),
                downloads,
                progress,
            ),
        )
        .await
        .expect("progress must not suspend a worker holding the reporter lock")
        .unwrap();
        assert_eq!(result, 42);
    }

    #[tokio::test]
    async fn cancel_interrupts_pending_downloads_and_progress() {
        let cancellation = tokio_util::sync::CancellationToken::new();
        let (started_tx, started_rx) = tokio::sync::oneshot::channel();
        let held = tokio::sync::Mutex::new(());
        let downloads = async {
            let _guard = held.lock().await;
            started_tx.send(()).unwrap();
            std::future::pending::<crate::Result<()>>().await
        };
        let cancel = async {
            started_rx.await.unwrap();
            cancellation.cancel();
        };
        let (result, ()) =
            tokio::time::timeout(Duration::from_secs(1), async {
                tokio::join!(
                    drive_downloads(
                        &cancellation,
                        downloads,
                        std::future::pending()
                    ),
                    cancel,
                )
            })
            .await
            .expect(
                "cancellation must not wait for the pending network operation",
            );
        assert!(result.is_err());
        assert!(held.try_lock().is_ok(), "download future must be dropped");
    }

    #[tokio::test]
    async fn canceled_preparation_does_not_start_more_work() {
        let cancellation = tokio_util::sync::CancellationToken::new();
        cancellation.cancel();
        let result = cancelable::<()>(&cancellation, async {
            panic!("canceled work must not be polled")
        })
        .await;
        assert!(result.is_err());
    }

    fn file(id: &str) -> ContentChangeFile {
        ContentChangeFile {
            id: id.to_string(),
            role: ContentChangeFileRole::Dependency,
            provider: ContentProvider::Modrinth,
            project_id: id.to_string(),
            release_id: id.to_string(),
            file_name: format!("{id}.jar"),
            target_relative_path: format!("cache/{id}.jar"),
            urls: Vec::new(),
            manual_download_url: None,
            integrity: ContentChangeFileIntegrity::default(),
        }
    }

    fn action(
        id: &str,
        status: ContentChangeActionStatus,
        files: Vec<ContentChangeFile>,
    ) -> ContentChangeAction {
        ContentChangeAction {
            content_id: id.to_string(),
            operation: ContentChangeOperation::Update,
            provider: ContentProvider::Modrinth,
            project_id: Some(id.to_string()),
            expected_release_id: Some("old".to_string()),
            target_release_id: "new".to_string(),
            relative_path: Some(format!("mods/{id}.jar")),
            current_provider_file_name: None,
            target_provider_file_name: None,
            final_relative_path: Some(format!("mods/{id}.jar")),
            files,
            dependencies: Vec::new(),
            status,
            error: None,
            completed: false,
        }
    }

    #[test]
    fn pending_downloads_are_deduplicated_across_actions() {
        let files = unique_pending_files(&[
            action(
                "first",
                ContentChangeActionStatus::Prepared,
                vec![file("primary-a"), file("shared")],
            ),
            action(
                "second",
                ContentChangeActionStatus::Prepared,
                vec![file("primary-b"), file("shared")],
            ),
        ]);

        assert_eq!(
            files
                .iter()
                .map(|file| file.id.as_str())
                .collect::<Vec<_>>(),
            vec!["primary-a", "primary-b", "shared"]
        );
    }

    #[test]
    fn completed_and_failed_actions_do_not_schedule_downloads() {
        let files = unique_pending_files(&[
            action(
                "completed",
                ContentChangeActionStatus::Completed,
                vec![file("completed")],
            ),
            action(
                "failed",
                ContentChangeActionStatus::Failed,
                vec![file("failed")],
            ),
            action(
                "pending",
                ContentChangeActionStatus::Prepared,
                vec![file("pending")],
            ),
        ]);

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].id, "pending");
    }
}
