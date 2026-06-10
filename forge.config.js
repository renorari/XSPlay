module.exports = {
  packagerConfig: {
    asar: true,
    icon: "./public/icon",
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-dmg",
      config: {
        name: "XSPlay",
      },
    },
    {
      name: "@electron-forge/maker-zip",
    },
  ],
};
