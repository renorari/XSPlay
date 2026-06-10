import { XREALDevice, DisplayMode } from "./xreal";

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

  // Try setting SBS mode
  console.log("Setting SBS 3840x1080 60Hz...");
  const ok = await dev.setDisplayMode(DisplayMode.MODE_SBS_3840x1080_60);
  console.log("Set mode result:", ok);

  // Enable IMU
  console.log("Enabling IMU...");
  await dev.enableIMU(true);

  dev.on("imu", (data) => {
    console.log(
      "IMU:",
      data.gyroscope.x.toFixed(3),
      data.gyroscope.y.toFixed(3),
      data.gyroscope.z.toFixed(3)
    );
  });

  setTimeout(() => {
    console.log("Disconnecting...");
    dev.disconnect();
    process.exit(0);
  }, 5000);
}

test().catch(console.error);
