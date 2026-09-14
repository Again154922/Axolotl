use crate::State;
use crate::state::{InstanceMetadata, SyncedOption};
use std::path::PathBuf;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct SyncedServer { pub id: String, pub position: i64, pub nbt: Vec<u8> }

pub(crate) async fn merge_servers_from_instance(_: &InstanceMetadata, _: &State) -> crate::Result<()> { Ok(()) }
pub(crate) async fn reconcile_servers(metadata: &InstanceMetadata, state: &State) -> crate::Result<()> {
    if !metadata.synced_options.multiplayer_servers { return Ok(()); }
    let local = crate::api::instance::synced_options::instance_dir(metadata, state).join("servers.dat");
    if !local.exists() { return Ok(()); }
    let bytes = tokio::fs::read(&local).await?;
    let path = canonical_path(state);
    if !path.exists() { tokio::fs::create_dir_all(path.parent().unwrap()).await?; tokio::fs::write(&path, &bytes).await?; }
    Ok(())
}
pub(crate) async fn seed_servers(metadata: &InstanceMetadata, state: &State) -> crate::Result<()> { reconcile_servers(metadata,state).await }
pub(crate) async fn ensure_servers(metadata: &InstanceMetadata, state: &State) -> crate::Result<()> {
    let canonical = canonical_path(state); if !canonical.exists() { return reconcile_servers(metadata,state).await; }
    let target = crate::api::instance::synced_options::instance_dir(metadata,state).join("servers.dat");
    if !target.exists() { tokio::fs::copy(canonical,target).await?; }
    Ok(())
}
pub(crate) async fn detach_servers(_: &InstanceMetadata, _: &State) -> crate::Result<()> { Ok(()) }
pub(crate) async fn canonical_exists(state: &State) -> crate::Result<bool> { Ok(canonical_path(state).exists()) }
pub async fn list_synced_servers() -> crate::Result<Vec<SyncedServer>> {
    let state=State::get().await?; let rows=sqlx::query("SELECT id, position, nbt FROM synced_servers ORDER BY position").fetch_all(&state.pool).await?;
    use sqlx::Row; Ok(rows.into_iter().map(|r| SyncedServer{id:r.get("id"),position:r.get("position"),nbt:r.get("nbt")}).collect())
}
pub async fn update_synced_server(server: SyncedServer) -> crate::Result<()> { let state=State::get().await?; sqlx::query("INSERT INTO synced_servers(id,position,nbt) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET position=excluded.position,nbt=excluded.nbt").bind(server.id).bind(server.position).bind(server.nbt).execute(&state.pool).await?; Ok(()) }
pub async fn remove_synced_server(id: String) -> crate::Result<()> { let state=State::get().await?; sqlx::query("DELETE FROM synced_servers WHERE id=?").bind(id).execute(&state.pool).await?; Ok(()) }
fn canonical_path(state: &State) -> PathBuf { state.directories.synced_options_dir().join("servers.dat") }
