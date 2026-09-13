{
  inputs,
  callPackage,
  symlinkJoin,

  launchEnv ? {},
  prebuilt,
  ...
}:
let
  enwrap = callPackage ./enwrap.nix { inherit inputs launchEnv prebuilt; };
  desktop = callPackage ./desktop.nix { inherit inputs; };
in
  symlinkJoin {
    name = "axolotl-launcher";
    paths = [
      enwrap desktop
    ];
  }
