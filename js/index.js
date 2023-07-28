const client = mqtt.connect("ws://broker.hivemq.com:8000/mqtt");
// const client = mqtt.connect("ws://localhost:8883");

const app = () => ({
  esp32s: [
    { pc: "Ale", id: "55914d23-0d9a-4fb2-a8cf-d13fa241fa52" },
    { pc: "Juan", id: "ab2a1359-0bbe-46a3-ad3c-e9141989224b" },
    { pc: "Jesus", id: "eb2a1359-0bbe-46a3-ad3c-e9141989224b" },
    { pc: "Argentina", id: "00d805e4-925d-40da-b436-ba3bfdc7cde6" },
    { pc: "Chuo", id: "d231c3b8-af05-490a-ac5a-fd39fa7e23a5" },
  ],
});

const esp32Controller = (id) => ({
  deviceTemperature: "0",
  deviceHumidity: "0",
  localtemperature: "50",
  localHumidity: "50",
  localServoPosition: 0,
  ledState: "off",
  init() {
    client.on("connect", () => {
      client.subscribe(this.tempTopic, (err) => {
        if (err) console.error(err);
      });
      client.subscribe(this.humidityDeviceTopic, (err) => {
        if (err) console.error(err);
      });
    });

    client.on("message", (topic, message) => {
      const stringMessage = message.toString();
      const { from, value } = JSON.parse(stringMessage);
      const isFromDevice = from === "device";

      if (!isFromDevice) {
        return;
      }

      switch (topic) {
        case this.tempTopic:
          this.deviceTemperature = value;
          break;
        case this.humidityDeviceTopic:
          this.deviceHumidity = value;
          break;
      }
    });

    this.$watch("localtemperature", (value) => {
      client.publish(
        this.tempTopic,
        JSON.stringify({
          from: "external",
          value,
          message: "Actualizar temperatura",
        })
      );
    });

    this.$watch("localHumidity", (value) => {
      client.publish(
        this.humidityDeviceTopic,
        JSON.stringify({
          from: "external",
          value,
          message: "Actualizar humedad",
        })
      );
    });

    this.$watch("localServoPosition", (value) => {
      client.publish(
        this.servoTopic,
        JSON.stringify({
          from: "external",
          value: value,
          message: "Actualizar servo",
        })
      );
    });

    this.$watch("ledState", (value) => {
      const message = JSON.stringify({
        from: "external",
        value: value,
        message: value === "off" ? "Encender led" : "Apagar led",
      });

      client.publish(this.ledTopic, message);
    });
  },
  get tempTopic() {
    return `${id}/temperature`;
  },
  get humidityDeviceTopic() {
    return `${id}/humidity`;
  },
  get ledTopic() {
    return `${id}/led`;
  },
  get servoTopic() {
    return `${id}/servo`;
  },
  get ledIsOff() {
    return this.ledState === "off";
  },
  get ledButtonText() {
    return this.ledIsOff ? "Encender led" : "Apagar led";
  },
  toggleLed() {
    this.ledState = this.ledIsOff ? "on" : "off";
  },
});
