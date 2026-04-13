require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`API CORRIENDO EN http://localhost:${PORT}`);
    //console.log(`Accesible en red local: http://192.168.1.9:${PORT}`);
});