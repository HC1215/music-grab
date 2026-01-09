{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.python311
    pkgs.ffmpeg
    pkgs.nodePackages.typescript-language-server
  ];
}
