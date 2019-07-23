#include <BLEServer.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#include <SPI.h>
#include <EPD1in54.h>
#include <EPDPaint.h>
#include <stdint.h>

// Device Name: Maximum 30 bytes
#define DEVICE_NAME "LINE Things Trial ESP32"

// User service UUID: Change this to your generated service UUID
#define USER_SERVICE_UUID "dc5a96e5-e7ab-4a6c-9051-ea5706f6b9e0"
// User service characteristics
#define WRITE_CHARACTERISTIC_UUID "E9062E71-9E62-4BC6-B0D3-35CDCD9B027B"
#define NOTIFY_CHARACTERISTIC_UUID "62FBD229-6EDD-4D1A-B554-5C4E1BB29169"

// PSDI Service UUID: Fixed value for Developer Trial
#define PSDI_SERVICE_UUID "E625601E-9E55-4597-A598-76018A0D293D"
#define PSDI_CHARACTERISTIC_UUID "26E2B12B-85F0-4F3F-9FDD-91D114270E6E"

#define BUTTON 0
#define LED1 2

#define COLORED     0
#define UNCOLORED   1

BLEServer* thingsServer;
BLESecurity *thingsSecurity;
BLEService* userService;
BLEService* psdiService;
BLECharacteristic* psdiCharacteristic;
BLECharacteristic* writeCharacteristic;
BLECharacteristic* notifyCharacteristic;

bool deviceConnected = false;
bool oldDeviceConnected = false;

volatile int btnAction = 0;

unsigned char image[40000];
EPDPaint paint(image, 0, 0);    // width should be the multiple of 8
EPD1in54 epd(33, 25, 26, 27); // reset, dc, cs, busy

class serverCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
   deviceConnected = true;
  };

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
  }
};

class writeCallback: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *bleWriteCharacteristic) {
    std::string value = bleWriteCharacteristic->getValue();
    uint8_t* data = bleWriteCharacteristic->getData();
    Serial.print("onWrite:");
    if (value.length() > 0) {
      draw(data[0], data[1]);
    }
  }
  void draw(int v, int di) {
    float r = 1.5 / (v / 10.0); // 隙間 
    float d = r * 5.0 / 2.0; // 半径
    float sf = 6.6;
  
    Serial.print(d);
    Serial.print(r);
    paint.setRotate(ROTATE_0);
    paint.setWidth(200);
    paint.setHeight(200);
  
    // 外枠の描写
    paint.clear(UNCOLORED);
    paint.drawFilledCircle(100, 100, d * sf, COLORED);
    paint.drawFilledCircle(100, 100, (d-r) * sf, UNCOLORED);
    if ( di == 0) {
      paint.drawFilledRectangle(100-(r/2)*sf, 100 -(d)*sf, 100+(r/2)*sf, 100, UNCOLORED);
    } else if (di == 1) {    
      paint.drawFilledRectangle(100, 100 -(r/2)*sf, 100+(d)*sf, 100 + (r/2)*sf, UNCOLORED);
    } else if (di == 2) {
      paint.drawFilledRectangle(100-(r/2)*sf, 100, 100+(r/2)*sf, 100 + (d)*sf, UNCOLORED);
    } else if (di == 3) {
      paint.drawFilledRectangle(100-(d)*sf, 100 -(r/2)*sf, 100, 100 + (r/2)*sf, UNCOLORED);
    }
    epd.setFrameMemory(paint.getImage(), 0, 0, paint.getWidth(), paint.getHeight());
    epd.displayFrame();
  }
};

void setup() {
  Serial.begin(115200);

  Serial.print("setup()");

  pinMode(LED1, OUTPUT);
  digitalWrite(LED1, 0);
  pinMode(BUTTON, INPUT_PULLUP);
  attachInterrupt(BUTTON, buttonAction, CHANGE);

  BLEDevice::init("");
  BLEDevice::setEncryptionLevel(ESP_BLE_SEC_ENCRYPT_NO_MITM);

  // Security Settings
  BLESecurity *thingsSecurity = new BLESecurity();
  thingsSecurity->setAuthenticationMode(ESP_LE_AUTH_REQ_SC_ONLY);
  thingsSecurity->setCapability(ESP_IO_CAP_NONE);
  thingsSecurity->setInitEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);

  setupServices();
  startAdvertising();
  Serial.println("Ready to Connect");

 if (epd.init(lutFullUpdate) != 0) {
    Serial.print("e-Paper init failed");
    return;
  }

  epd.clearFrameMemory(0xFF);   // bit set = white, bit reset = black
  epd.displayFrame();
  epd.clearFrameMemory(0xFF);   // bit set = white, bit reset = black
  epd.displayFrame();

}

void loop() {
  uint8_t btnValue;

  while (btnAction > 0 && deviceConnected) {
    btnValue = !digitalRead(BUTTON);
    btnAction = 0;
    notifyCharacteristic->setValue(&btnValue, 1);
    notifyCharacteristic->notify();
    delay(20);
  }
  // Disconnection
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // Wait for BLE Stack to be ready
    thingsServer->startAdvertising(); // Restart advertising
    oldDeviceConnected = deviceConnected;
  }
  // Connection
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }
}

void setupServices(void) {
  // Create BLE Server
  thingsServer = BLEDevice::createServer();
  thingsServer->setCallbacks(new serverCallbacks());

  // Setup User Service
  userService = thingsServer->createService(USER_SERVICE_UUID);
  // Create Characteristics for User Service
  writeCharacteristic = userService->createCharacteristic(WRITE_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_WRITE);
  writeCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);
  writeCharacteristic->setCallbacks(new writeCallback());

  notifyCharacteristic = userService->createCharacteristic(NOTIFY_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  notifyCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);
  BLE2902* ble9202 = new BLE2902();
  ble9202->setNotifications(true);
  ble9202->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);
  notifyCharacteristic->addDescriptor(ble9202);

  // Setup PSDI Service
  psdiService = thingsServer->createService(PSDI_SERVICE_UUID);
  psdiCharacteristic = psdiService->createCharacteristic(PSDI_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_READ);
  psdiCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);

  // Set PSDI (Product Specific Device ID) value
  uint64_t macAddress = ESP.getEfuseMac();
  psdiCharacteristic->setValue((uint8_t*) &macAddress, sizeof(macAddress));

  // Start BLE Services
  userService->start();
  psdiService->start();
}

void startAdvertising(void) {
  // Start Advertising
  BLEAdvertisementData scanResponseData = BLEAdvertisementData();
  scanResponseData.setFlags(0x06); // GENERAL_DISC_MODE 0x02 | BR_EDR_NOT_SUPPORTED 0x04
  scanResponseData.setName(DEVICE_NAME);

  thingsServer->getAdvertising()->addServiceUUID(userService->getUUID());
  thingsServer->getAdvertising()->setScanResponseData(scanResponseData);
  thingsServer->getAdvertising()->start();
}

void buttonAction() {
  btnAction++;
}
