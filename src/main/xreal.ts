/**
 * XREAL Air / Air 2 / Air 2 Pro communication library.
 * Based on reverse-engineered HID protocols from nrealAirLinuxDriver.
 */

import HID from "node-hid";
import { EventEmitter } from "events";

const XREAL_VID = 0x3318;
const XREAL_PIDS = [0x0424, 0x0428, 0x0432];

const MCU_INTERFACE = 4;
const IMU_INTERFACE = 3;

// CRC32 table from nrealAirLinuxDriver
const CRC32_TABLE = new Uint32Array([
  0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f,
  0xe963a535, 0x9e6495a3, 0x0edb8832, 0x79dcb8a4, 0xe0d5e91e, 0x97d2d988,
  0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91, 0x1db71064, 0x6ab020f2,
  0xf3b97148, 0x84be41de, 0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7,
  0x136c9856, 0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9,
  0xfa0f3d63, 0x8d080df5, 0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172,
  0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b, 0x35b5a8fa, 0x42b2986c,
  0xdbbbc9d6, 0xacbcf940, 0x32d86ce3, 0x45df5c75, 0xdcd60dcf, 0xabd13d59,
  0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423,
  0xcfba9599, 0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924,
  0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d, 0x76dc4190, 0x01db7106,
  0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433,
  0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d,
  0x91646c97, 0xe6635c01, 0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e,
  0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950,
  0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65,
  0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2, 0x4adfa541, 0x3dd895d7,
  0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0,
  0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa,
  0xbe0b1010, 0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f,
  0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81,
  0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a,
  0xead54739, 0x9dd277af, 0x04db2615, 0x73dc1683, 0xe3630b12, 0x94643b84,
  0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1,
  0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb,
  0x196c3671, 0x6e6b06e7, 0xfed41b76, 0x89d32be0, 0x10da7a5a, 0x67dd4acc,
  0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5, 0xd6d6a3e8, 0xa1d1937e,
  0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b,
  0xd80d2bda, 0xaf0a1b4c, 0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55,
  0x316e8eef, 0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236,
  0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe, 0xb2bd0b28,
  0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d,
  0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f,
  0x72076785, 0x05005713, 0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38,
  0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21, 0x86d3d2d4, 0xf1d4e242,
  0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777,
  0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69,
  0x616bffd3, 0x166ccf45, 0xa00ae278, 0xd70dd2ee, 0x4e048354, 0x3903b3c2,
  0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc,
  0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9,
  0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605, 0xcdd70693,
  0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94,
  0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d,
]);

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (~crc) >>> 0;
}

function writeUInt16LE(buf: Buffer, offset: number, value: number) {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

function writeUInt32LE(buf: Buffer, offset: number, value: number) {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

function writeUInt64LE(buf: Buffer, offset: number, value: bigint) {
  const low = Number(value & BigInt(0xffffffff));
  const high = Number(value >> BigInt(32));
  buf[offset] = low & 0xff;
  buf[offset + 1] = (low >>> 8) & 0xff;
  buf[offset + 2] = (low >>> 16) & 0xff;
  buf[offset + 3] = (low >>> 24) & 0xff;
  buf[offset + 4] = high & 0xff;
  buf[offset + 5] = (high >>> 8) & 0xff;
  buf[offset + 6] = (high >>> 16) & 0xff;
  buf[offset + 7] = (high >>> 24) & 0xff;
}

function readUInt16LE(buf: Buffer, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readUInt32LE(buf: Buffer, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24);
}

function readUInt64LE(buf: Buffer, offset: number): bigint {
  const low = BigInt(readUInt32LE(buf, offset));
  const high = BigInt(readUInt32LE(buf, offset + 4));
  return (high << BigInt(32)) | low;
}

// Display modes for XREAL Air / Air 2
export enum DisplayMode {
  MODE_2D_1080P60 = 0x01,
  MODE_SBS_3840x1080_60 = 0x03,
  MODE_SBS_3840x1080_72 = 0x04,
  MODE_2D_1080P72 = 0x05,
  MODE_SBS_HALF_1080P60 = 0x08,
  MODE_SBS_3840x1080_90 = 0x09,
  MODE_2D_1080P90 = 0x0a,
  MODE_2D_1080P120 = 0x0b,
}

export interface IMUData {
  timestamp: bigint;
  temperature: number;
  gyroscope: { x: number; y: number; z: number };
  accelerometer: { x: number; y: number; z: number };
  magnetometer: { x: number; y: number; z: number };
}

export class XREALDevice extends EventEmitter {
  private mcuDevice: HID.HID | null = null;
  private imuDevice: HID.HID | null = null;
  private imuEnabled = false;
  private running = false;
  private readLoopTimer: NodeJS.Timeout | null = null;

  private pack16bitSigned(data: Buffer, offset: number): number {
    return data.readInt16LE(offset);
  }

  private pack32bitSigned(data: Buffer, offset: number): number {
    return data.readInt32LE(offset);
  }

  private pack24bitSigned(data: Buffer, offset: number): number {
    const val = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
    return val >= 0x800000 ? val - 0x1000000 : val;
  }

  private pack16bitSignedSwap(data: Buffer, offset: number): number {
    return data.readInt16BE(offset);
  }

  private pack32bitSignedSwap(data: Buffer, offset: number): number {
    return data.readInt32BE(offset);
  }

  private pack16bitSignedBizarre(data: Buffer, offset: number): number {
    const val = data[offset] | ((data[offset + 1] ^ 0x80) << 8);
    return val >= 0x8000 ? val - 0x10000 : val;
  }

  private buildMCUMessage(msgid: number, data: Buffer): Buffer {
    const packetLen = 17 + data.length;
    const payloadLen = 5 + packetLen;
    const buf = Buffer.alloc(payloadLen);
    buf[0] = 0xfd;
    writeUInt16LE(buf, 5, packetLen);
    writeUInt64LE(buf, 7, BigInt(0));
    writeUInt16LE(buf, 15, msgid);
    buf.fill(0, 17, 22); // reserved
    data.copy(buf, 22);

    const checksumData = buf.subarray(5, 5 + packetLen);
    const checksum = crc32(checksumData);
    writeUInt32LE(buf, 1, checksum);

    return buf;
  }

  private buildIMUMessage(msgid: number, data: Buffer): Buffer {
    const packetLen = 3 + data.length;
    const payloadLen = 5 + packetLen;
    const buf = Buffer.alloc(payloadLen);
    buf[0] = 0xaa;
    writeUInt16LE(buf, 5, packetLen);
    buf[7] = msgid;
    data.copy(buf, 8);

    const checksumData = buf.subarray(5, 5 + packetLen);
    const checksum = crc32(checksumData);
    writeUInt32LE(buf, 1, checksum);

    return buf;
  }

  private parseIMUPacket(buf: Buffer): IMUData | null {
    if (buf.length < 64) return null;
    if (buf[0] !== 0x01 || buf[1] !== 0x02) return null;

    const tempRaw = buf.readInt16LE(2);
    const timestamp = readUInt64LE(buf, 4);

    const velM = this.pack16bitSigned(buf, 12);
    const velD = this.pack32bitSigned(buf, 14);
    const velX = this.pack24bitSigned(buf, 18);
    const velY = this.pack24bitSigned(buf, 21);
    const velZ = this.pack24bitSigned(buf, 24);

    const accelM = this.pack16bitSigned(buf, 27);
    const accelD = this.pack32bitSigned(buf, 29);
    const accelX = this.pack24bitSigned(buf, 33);
    const accelY = this.pack24bitSigned(buf, 36);
    const accelZ = this.pack24bitSigned(buf, 39);

    const magnetM = this.pack16bitSignedSwap(buf, 42);
    const magnetD = this.pack32bitSignedSwap(buf, 44);
    const magnetX = this.pack16bitSignedBizarre(buf, 48);
    const magnetY = this.pack16bitSignedBizarre(buf, 50);
    const magnetZ = this.pack16bitSignedBizarre(buf, 52);

    return {
      timestamp,
      temperature: tempRaw / 100.0,
      gyroscope: {
        x: (velX * velM) / velD,
        y: (velY * velM) / velD,
        z: (velZ * velM) / velD,
      },
      accelerometer: {
        x: (accelX * accelM) / accelD,
        y: (accelY * accelM) / accelD,
        z: (accelZ * accelM) / accelD,
      },
      magnetometer: {
        x: (magnetX * magnetM) / magnetD,
        y: (magnetY * magnetM) / magnetD,
        z: (magnetZ * magnetM) / magnetD,
      },
    };
  }

  findDevices(): { mcuPath?: string; imuPath?: string } {
    const devices = HID.devices();
    const xreal = devices.filter(
      (d) => d.vendorId === XREAL_VID && XREAL_PIDS.includes(d.productId)
    );

    let mcuPath: string | undefined;
    let imuPath: string | undefined;

    for (const d of xreal) {
      if (d.interface === MCU_INTERFACE && d.usagePage === 65) {
        mcuPath = d.path;
      }
      if (d.interface === IMU_INTERFACE && d.usagePage === 65) {
        imuPath = d.path;
      }
    }

    return { mcuPath, imuPath };
  }

  isConnected(): boolean {
    const { mcuPath, imuPath } = this.findDevices();
    return !!mcuPath && !!imuPath;
  }

  connect(): boolean {
    const { mcuPath, imuPath } = this.findDevices();
    if (!mcuPath || !imuPath) {
      return false;
    }

    try {
      this.mcuDevice = new HID.HID(mcuPath);
      this.imuDevice = new HID.HID(imuPath);
      this.running = true;
      this.startReadLoop();
      return true;
    } catch (e) {
      this.disconnect();
      return false;
    }
  }

  disconnect() {
    this.running = false;
    if (this.readLoopTimer) {
      clearTimeout(this.readLoopTimer);
      this.readLoopTimer = null;
    }
    if (this.mcuDevice) {
      try { this.mcuDevice.close(); } catch { /* ignore */ }
      this.mcuDevice = null;
    }
    if (this.imuDevice) {
      try { this.imuDevice.close(); } catch { /* ignore */ }
      this.imuDevice = null;
    }
    this.imuEnabled = false;
  }

  private startReadLoop() {
    const loop = () => {
      if (!this.running) return;
      this.readOnce();
      this.readLoopTimer = setTimeout(loop, 1); // ~1000Hz max
    };
    loop();
  }

  private readOnce() {
    if (!this.imuDevice || !this.running) return;

    try {
      const data = this.imuDevice.readTimeout(0); // non-blocking
      if (data && data.length >= 64) {
        const imu = this.parseIMUPacket(Buffer.from(data));
        if (imu) {
          this.emit("imu", imu);
        }
      }
    } catch {
      // non-blocking read may throw if no data
    }
  }

  async sendMCUMessage(msgid: number, data: Buffer, responseMsgId?: number): Promise<Buffer | null> {
    if (!this.mcuDevice) return null;

    const packet = this.buildMCUMessage(msgid, data);
    this.mcuDevice.write(packet);

    if (responseMsgId === undefined) return null;

    // Wait for response
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      try {
        const resp = this.mcuDevice.readTimeout(100);
        if (resp && resp.length > 0) {
          const buf = Buffer.from(resp);
          if (buf[0] === 0xfd) {
            const respMsgId = readUInt16LE(buf, 15);
            if (respMsgId === responseMsgId) {
              return buf;
            }
          }
        }
      } catch {
        // timeout or error
      }
    }
    return null;
  }

  async setDisplayMode(mode: DisplayMode): Promise<boolean> {
    const resp = await this.sendMCUMessage(0x0008, Buffer.from([mode]), 0x0008);
    return resp !== null;
  }

  async getDisplayMode(): Promise<DisplayMode | null> {
    const resp = await this.sendMCUMessage(0x0007, Buffer.alloc(0), 0x0007);
    if (!resp || resp.length < 24) return null;
    return resp[23] as DisplayMode;
  }

  async enableIMU(enable: boolean): Promise<boolean> {
    if (!this.imuDevice) return false;

    const packet = this.buildIMUMessage(0x19, Buffer.from([enable ? 1 : 0]));
    this.imuDevice.write(packet);
    this.imuEnabled = enable;
    return true;
  }

  get isIMUEnabled() {
    return this.imuEnabled;
  }
}
