{
  description = "Axolotl: a free, open-source, ad-free, cross-platform Minecraft Java Edition launcher";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = inputs: {
    packages = builtins.mapAttrs (system: pkgs: {
      axolotl = pkgs.callPackage ./nix/package.nix {};

      default = inputs.self.packages.${system}.axolotl;
    }) inputs.nixpkgs.legacyPackages;
    homeModules = import ./nix/home-module.nix;
  };
}
