// User service UUID: Change this to your generated service UUID
const USER_SERVICE_UUID         = 'dc5a96e5-e7ab-4a6c-9051-ea5706f6b9e0'; // LED, Button
// User service characteristics
const RING_CHARACTERISTIC_UUID   = 'E9062E71-9E62-4BC6-B0D3-35CDCD9B027B';

// PSDI Service UUID: Fixed value for Developer Trial
const PSDI_SERVICE_UUID         = 'E625601E-9E55-4597-A598-76018A0D293D'; // Device ID
const PSDI_CHARACTERISTIC_UUID  = '26E2B12B-85F0-4F3F-9FDD-91D114270E6E';

const TOP = 0;
const LEFT = 1;
const BUTTOM = 2;
const RIGHT = 3;

// UI settings
let direction = 0; // 0: RIGHT, 1: LEFT
let hole = Math.floor(Math.random() * Math.floor(4)); //     0: top, 1: right, 2: buttom, 3: left
let vision = 0; // 0.3 ~ 2.0
let fail = 0;
let failed = '';
let result = '';
const directions = ["右", "左"];
const visions = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0];


// -------------- //
// On window load //
// -------------- //

window.onload = () => {
    initializeApp();
};

// ----------------- //
// Handler functions //
// ----------------- //

function gameOver(){
    const elRetry = document.getElementById("retry");
    elRetry.classList.remove("hidden");            
    const elTop = document.getElementById("top");
    elTop.disabled = true;            
    const elLeft = document.getElementById("left");
    elLeft.disabled = true;            
    const elRight = document.getElementById("right");
    elRight.disabled = true;            
    const elButtom = document.getElementById("buttom");
    elButtom.disabled = true;            
}
function retry(){
    direction = 0;
    result = '';
    const elRetry = document.getElementById("retry");
    elRetry.classList.add("hidden");
    const elTop = document.getElementById("top");
    elTop.disabled = false;            
    const elLeft = document.getElementById("left");
    elLeft.disabled = false;            
    const elRight = document.getElementById("right");
    elRight.disabled = false;            
    const elButtom = document.getElementById("buttom");
    elButtom.disabled = false;            
    uiToggleLedButton();      
}
function handlerToggleLed(answer) {
    if (hole != answer){
        fail++;
        failed = failed + '\u274c';
        if (fail > 1 ){
            failed = '\u200B';
            fail = 0;
            result = result + directions[direction] + ":" + ((vision > 0) ? parseFloat(visions[vision-1]).toFixed(1) : "測定不能");
            direction++;
            vision = 0;
            if (direction > 1){
                gameOver();
            }
        }
    } else {
        fail = 0;
        failed = '\u200B';
        vision++;
        if (visions.length <= vision){
            result = result + directions[direction] + ":" + parseFloat(visions[vision-1]).toFixed(1);
            direction++;
            vision = 0;
            if (direction > 1){
                gameOver();
            }
        }
    }
    hole = Math.floor(Math.random() * Math.floor(4)); 

    uiToggleLedButton();
    liffToggleDeviceLedState();
}

// ------------ //
// UI functions //
// ------------ //

function uiToggleLedButton() {
    const trialEl = document.getElementById("trial");
    trialEl.innerText = (direction < 2)? (directions[direction] + ':' + parseFloat(visions[vision]).toFixed(1)) : "";

    const resultEl = document.getElementById("result");
    resultEl.innerText = result;

    const failEl = document.getElementById("fail");
    failEl.innerText = failed;

}

function uiToggleDeviceConnected(connected) {
    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");

    elStatus.classList.remove("error");

    if (connected) {
        // Hide loading animation
        uiToggleLoadingAnimation(false);
        // Show status connected
        elStatus.classList.remove("inactive");
        elStatus.classList.add("success");
        elStatus.innerText = "Device connected";
        // Show controls
        elControls.classList.remove("hidden");
    } else {
        // Show loading animation
        uiToggleLoadingAnimation(true);
        // Show status disconnected
        elStatus.classList.remove("success");
        elStatus.classList.add("inactive");
        elStatus.innerText = "Device disconnected";
        // Hide controls
//        elControls.classList.add("hidden");
    }
}

function uiToggleLoadingAnimation(isLoading) {
    const elLoading = document.getElementById("loading-animation");

    if (isLoading) {
        // Show loading animation
        elLoading.classList.remove("hidden");
    } else {
        // Hide loading animation
        elLoading.classList.add("hidden");
    }
}

function uiStatusError(message, showLoadingAnimation) {
    uiToggleLoadingAnimation(showLoadingAnimation);

    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");

    // Show status error
    elStatus.classList.remove("success");
    elStatus.classList.remove("inactive");
    elStatus.classList.add("error");
    elStatus.innerText = message;

    // Hide controls
//    elControls.classList.add("hidden");
}

function makeErrorMsg(errorObj) {
    return "Error\n" + errorObj.code + "\n" + errorObj.message;
}

// -------------- //
// LIFF functions //
// -------------- //

function initializeApp() {
    liff.init(() => initializeLiff(), error => uiStatusError(makeErrorMsg(error), false));
}

function initializeLiff() {
    liff.initPlugins(['bluetooth']).then(() => {
        liffCheckAvailablityAndDo(() => liffRequestDevice());
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffCheckAvailablityAndDo(callbackIfAvailable) {
    // Check Bluetooth availability
    liff.bluetooth.getAvailability().then(isAvailable => {
        if (isAvailable) {
            uiToggleDeviceConnected(false);
            callbackIfAvailable();
        } else {
            uiStatusError("Bluetooth not available", true);
            setTimeout(() => liffCheckAvailablityAndDo(callbackIfAvailable), 10000);
        }
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });;
}

function liffRequestDevice() {
    liff.bluetooth.requestDevice().then(device => {
        liffConnectToDevice(device);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffConnectToDevice(device) {
    device.gatt.connect().then(() => {

        // Show status connected
        uiToggleDeviceConnected(true);

        // Get service
        device.gatt.getPrimaryService(USER_SERVICE_UUID).then(service => {
            liffGetUserService(service);
        }).catch(error => {
            uiStatusError(makeErrorMsg(error), false);
        });
        device.gatt.getPrimaryService(PSDI_SERVICE_UUID).then(service => {
            liffGetPSDIService(service);
        }).catch(error => {
            uiStatusError(makeErrorMsg(error), false);
        });

        // Device disconnect callback
        const disconnectCallback = () => {
            // Show status disconnected
            uiToggleDeviceConnected(false);

            // Remove disconnect callback
            device.removeEventListener('gattserverdisconnected', disconnectCallback);

            // Reset LED state
            ledState = false;
            // Reset UI elements
            uiToggleLedButton(false);

            // Try to reconnect
            initializeLiff();
        };

        device.addEventListener('gattserverdisconnected', disconnectCallback);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetUserService(service) {
    // Button pressed state
    service.getCharacteristic(RING_CHARACTERISTIC_UUID).then(characteristic => {
        window.ringCharacteristic = characteristic;

    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetPSDIService(service) {
    // Get PSDI value
    service.getCharacteristic(PSDI_CHARACTERISTIC_UUID).then(characteristic => {
        return characteristic.readValue();
    }).then(value => {
        // Byte array to hex string
        const psdi = new Uint8Array(value.buffer)
            .reduce((output, byte) => output + ("0" + byte.toString(16)).slice(-2), "");
        document.getElementById("device-psdi").innerText = psdi;
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffToggleDeviceRingState(state) {
    window.ringCharacteristic.writeValue(
        state
    ).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffToggleDeviceLedState(stae) {
    window.ledCharacteristic.writeValue(
        new Uint8Array([visions[vision] * 10, hole])
    ).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}
