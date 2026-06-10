const { XREALDevice, DisplayMode } = require("./dist/main/xreal");

async function test() {
  const dev = new XREALDevice();
  console.log("Connected?", dev.isConnected());

  if (!dev.connect()) {
    console.error("Failed to connect");
    return;
  }

  console.log("Connected!");

  const mode = await dev.getDisplayMode();
  console.log("Current display mode:", mode);

  console.log("Setting SBS 3840x1080 60Hz...");
  const ok = await dev.setDisplayMode(DisplayMode.MODE_SBS_3840x1080_60);
  console.log("Set mode result:", ok);

  console.log("Enabling IMU...");
  await dev.enableIMU(true);

  let count = 0;
  dev.on("imu", (data) => {
    if (count++ < 10) {
      console.log(
        "IMU gyro:",
        data.gyroscope.x.toFixed(3),
        data.gyroscope.y.toFixed(3),
        data.gyroscope.z.toFixed(3)
      );
    }
  });

  setTimeout(() => {
    console.log("Disconnecting...");
    dev.disconnect();
    process.exit(0);
  }, 3000);
}

test().catch(console.error);
