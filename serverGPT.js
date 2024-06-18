const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const session = require("express-session");
const cookieParser = require("cookie-parser");

const app = express();
app.use(bodyParser.json());


// Initialization
app.use(cookieParser());

app.use(session({
    secret: "amar",
    saveUninitialized: true,
    resave: true
}));


//exportc WHATSAPP_APPLICATION_CREDENTIALS="fdsgf"
//export GOOGLE_APPLICATION_CREDENTIALS="google_cloud_key.json"
//export OPENAI_API_KEY=""

//Global variables
const token_whatsapp = process.env.WHATSAPP_APPLICATION_CREDENTIALS;
const url_whatsapp = "https://graph.facebook.com/v19.0/";
// Ruta donde se guardará el nuevo archivo de audio
//const audioFilePath = path.join(__dirname, 'audio_from_whatsapp.ogg');

const conversation = {
  messages: [{role: "system", content: "Respomdeme como si fueras jarvis de ironman"}],
  model: "gpt-3.5-turbo",
};


app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = 'q1w2e3r4t5y6u7i8o9p0';

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});


app.post('/webhook', async (req, res) => {
      //Si la session no existe la guardo
      if (!req.session.conversation) {
        req.session.conversation = conversation;
        req.session.save();
      }
      const message = req.body;
      if (message.entry && message.entry[0] && message.entry[0].changes && message.entry[0].changes[0].value.messages) {
          const messages = message.entry[0].changes[0].value.messages;
          for (let msg of messages) {
                  const from = msg.from; // Número de teléfono del remitente
                  const nameFile = from.toString() +'.ogg';
                  const audioFilePath = path.join(__dirname, nameFile);
                  //console.log(msg);
                  if (msg.type === 'audio') {
                      const audioId = msg.audio.id; // ID del mensaje de audio
                      const mimeType = msg.audio.mime_type; // Tipo MIME del audio
                      const url = url_whatsapp + audioId;
                      try {
                          //Llamo al primer metodo para obtener el ID del Audio.
                          const url_whatsapp_audio = await axios.get(url, {
                              headers: {
                                  'Authorization': `Bearer ${token_whatsapp}`,
                                  "User-Agent":
                                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
                              }
                          });
                          //Llamo al primer metodo para obtener el ID del Audio.
                          //console.log('URL:',url_whatsapp_audio.data.url);
                          const audioResponse = await axios.get(url_whatsapp_audio.data.url, {
                              headers: {
                                  'Authorization': `Bearer ${token_whatsapp}`,
                                  "User-Agent":
                                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
                              },
                               responseType: 'arraybuffer',
                          });
                                 
                          const audioBuffer = Buffer.from(audioResponse.data);
               
                          // Paso 3: Escribir el buffer de audio en un archivo en el sistema de archivos local
                          fs.writeFileSync(audioFilePath, Buffer.from(audioBuffer));
                          // Aquí puedes agregar la lógica para procesar el archivo de audio
                          const transcription = await transcribeAudio(req, audioFilePath);
                          //console.log(transcription);
                          await sendTextMessage(msg.from, transcription);

                    } catch (error) {
                        console.error('Error fetching audio:', error);
                        req.session.destroy();
                        res.sendStatus(404);
                    }
                } else if (msg.type === 'text')  {
                    const message = msg.text.body; // Texto del mensaje
                    //console.log(message);
                    // if(msg.text.body === 'Resumir' || msg.text.body === 'resumir' ) {
                    //   const transcription = await transcribeAudio(audioFilePath);
                    //   //console.log(transcription);
                    //   const gptResponse = await chatGPTProcessing(req, message + '; ' + transcription);
                    //   await sendTextMessage(msg.from, gptResponse.message.content);
                    // }
                      if(msg.text.body === '#reiniciar' || msg.text.body === '#Reiniciar') {
                      const conversation = {
                        messages: [{role: "system", content: "Respomdeme como si fueras jarvis de ironman"}],
                        model: "gpt-3.5-turbo",
                      };
                      //console.log('Conversation:', conversation.messages);
                      req.session.conversation = conversation;
                      await chatGPTProcessing(req, '');
                      req.session.save();
                      req.session.destroy();
                    } else if(msg.text.body === '/help' || msg.text.body === '/Help' || msg.text.body === '/ayuda' || msg.text.body === '/Ayuda') {
                      await sendTextMessage(msg.from, 'Puedes enviarme un audio para trasnscribir, si escribis resumir, luego del audio te lo entrego resumido... para reiniciar la conversacion ingresa #reiniciar y si me escribis de cualquier tema te puedo ayudar simulando que soy J.A.R.V.I.S. :)');
                    } 
                    else {
                      const gptResponse = await chatGPTProcessing(req, message);
                      await sendTextMessage(msg.from, gptResponse.message.content);
                    }
                   
                    
                } else {
                    const message = msg.text.body; // Texto del mensaje
                    await sendTextMessage(msg.from, "Este es un servicio de Transcripcion de Audios desarrollado por Bowtielabs LLC, en breve estaremos integrando IA y muchas funciones mas!!");
                    //console.log(`Message from ${from}: ${message}`);
                }

                // Responder con un 200 para confirmar la recepción del mensaje
                res.sendStatus(200);
            }
    }
});

// Función para transcribir el archivo de audio utilizando OpenAI
async function transcribeAudio(req, audioFilePath) {
    const openai = new OpenAI();
    const conversation = req.session.conversation;
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFilePath),
            model: "whisper-1",
          });
      conversation.messages.push({role: "assistant", content: transcription.text }); 
      //save conversation to session
      req.session.conversation = conversation;
      req.session.save();   
      return transcription.text;
    } catch (error) {
      throw new Error(error.response ? error.response.data : error.message);
    }
  }
  
  async function sendTextMessage(to, text) {
    const url = url_whatsapp + '368320819689944/messages';
      // Datos del mensaje que deseas enviar
      const data = {
          messaging_product: "whatsapp",
          to: to,
          text: {
          body: text
          }
      };
      
    // Configuración del encabezado, incluyendo el token de acceso
    const config = {
      headers: {
        'Authorization': `Bearer ${token_whatsapp}`,
        'Content-Type': 'application/json'
      }
    };
    
    // Hacer la solicitud POST usando Axios
    axios.post(url, data, config)
      .then(response => {
        //console.log('Mensaje enviado:', response.data);
      })
      .catch(error => {
        console.error('Error al enviar el mensaje:', error.response ? error.response.data : error.message);
      });
  
  }
  
  
  async function chatGPTProcessing(req, user_text) {
    const openai = new OpenAI();
    const conversation = req.session.conversation;
    conversation.messages.push({role: "user", content: user_text });
    const completion = await openai.chat.completions.create(conversation);
    conversation.messages.push({role: "assistant", content: completion.choices[0].message.content });
    //save conversation to session
    req.session.conversation = conversation;
    req.session.save();
    return completion.choices[0];
    //console.log(completion.choices[0]);
  }
  

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});