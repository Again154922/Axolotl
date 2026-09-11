{
  description = "Axolotl: a free, open-source, ad-free, cross-platform Minecraft Java Edition launcher";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    self.submodules = true;
  };

  outputs = inputs: {
    packages = builtins.mapAttrs (system: pkgs: {
      axolotl = pkgs.callPackage ./nix/package.nix {};
      axolotl-bin = pkgs.callPackage ./nix/package.nix { prebuilt = true; };
      axolotl-git = pkgs.callPackage ./nix/package.nix { prebuilt = false; };
      default = inputs.self.packages.${system}.axolotl;
    }) inputs.nixpkgs.legacyPackages;
    homeModules = import ./nix/home-module.nix;
  };
}
