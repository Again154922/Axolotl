{
  description = "Axolotl Launcher: Your last launcher.";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    self.submodules = true;
  };

  outputs = inputs: (
    let
      legacyPackages = builtins.mapAttrs (system: pkgs:
        import inputs.nixpkgs {
          inherit system;
          overlays = [ (inputs.rust-overlay.overlays.default) ];
        }
      ) inputs.nixpkgs.legacyPackages;
    in
      {
        devShells = builtins.mapAttrs (system: pkgs: {
          default = pkgs.callPackage ./nix/devShell.nix { inherit inputs; };
        }) legacyPackages;
        packages = builtins.mapAttrs (system: pkgs: {
          axolotl = pkgs.callPackage ./nix/package.nix { inherit inputs; };
          axolotl-bin = pkgs.callPackage ./nix/package.nix { inherit inputs; prebuilt = true; };
          axolotl-git = pkgs.callPackage ./nix/package.nix { inherit inputs; prebuilt = false; };
          default = inputs.self.packages.${system}.axolotl;
        }) legacyPackages;
        homeModules = import ./nix/home-module.nix;
      }
  );
}
