const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const session = require("express-session");
const cookieParser = require("cookie-parser");
require('log-timestamp');

const app = express();
app.use(bodyParser.json());


// Initialization
app.use(cookieParser());

app.use(session({
  secret: "q1w2e3r4t5y6u7i8o9p0",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60000 } // session timeout of 120 seconds
}));


//exportc WHATSAPP_APPLICATION_CREDENTIALS="fdsgf"
//export GOOGLE_APPLICATION_CREDENTIALS="google_cloud_key.json"
//export OPENAI_API_KEY=""

//Global variables
const token_whatsapp = process.env.WHATSAPP_APPLICATION_CREDENTIALS_SC;
const url_whatsapp = "https://graph.facebook.com/v19.0/";

console.log(token_whatsapp);

const conversationArray = [{ conversationId: 0, conversation: {} }];

app.get('/scoti', (req, res) => {
  const VERIFY_TOKEN = 'q1w2e3r4t5y6u7i8o9p0';

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      //console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});


app.post('/scoti', async (req, res) => {
  var message = req.body;
  if (message.entry && message.entry[0] && message.entry[0].changes && message.entry[0].changes[0].value.messages) {
    //console.log("ENTRA UN REQ:", JSON.stringify(message));
    //Si la session no existe la guardo
    var sessionData = req.session;
    if (!sessionData) {
      sessionData.conversationArray = conversationArray;
      req.session = sessionData;
      //console.log("Sesion no existe, la creo:", sessionData);
    } else {
      //console.log("Sesion ya existe:", sessionData);
      sessionData.conversationArray = conversationArray;
      req.session = sessionData;
    }
    //console.log(sessionData);
    const conversation = {
      messages: [{ role: "system", content: "Respondeme como un asistente virtual del Banco Scotiabank Uruguay, llamado Scoti, podes dar informacion sobre los horarios de atencion, que son de 10 a 13hs en la sucursal, podes contar que estamos trabajando en una transformacion digital muy grande, que implica involucrar a todos los integrantes del banco, podes contar que estamos en la direccion Rincon 390 Montevideo, ademas podes saber que el nuevo VP de modernizacion se llama Luis Ivaldi y esta empujando mucho la transformacion, ademas podes contar que es scotiabank" }],
      //model: "gpt-3.5-turbo",
      model: "gpt-4o",
    };
    const messages = message.entry[0].changes[0].value.messages;
    for (let msg of messages) {
      const from = msg.from; // Número de teléfono del remitente
      const nameFile = from.toString() + '.ogg';
      const audioFilePath = path.join(__dirname, nameFile);
      const conversationId = from;
      if (!findSession(conversationId)) {
        conversationArray.push({ conversationId: conversationId, conversation: conversation });
        sessionData.conversationArray = conversationArray;
      }
      //console.log('CONVERSATION:',findSession(conversationId));
      //console.log(conversationArray);
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
          const transcription = await transcribeAudio(conversationId, req, audioFilePath);
          //console.log(transcription);
          await sendTextMessage('txt', msg.from, transcription);
          //Borro el archivo
          deleteTempFile(audioFilePath);
        } catch (error) {
          console.error('Error fetching audio:', error);
          req.session.destroy();
          res.sendStatus(404);
        }
      } else if (msg.type === 'text') {
        //const message = msg.text.body; // Texto del mensaje
        if (msg.text.body === '###REINICIAR' || msg.text.body === '###reiniciar') {
          for (let conversation_ of conversationArray) {
            if (conversation_.conversationId === conversationId) {
              conversation_.conversation = conversation;
              //save conversation to session
              //console.log("LN-128-ENTRO EN REINICIAR:", conversation_.conversation.messages);
              req.session.conversationArray = conversationArray;
            }
          }
          await chatGPTProcessing(conversationId, req, 'Cerrar Conversacion');
          await sendTextMessage('txt', msg.from, 'Reinicio completo...');
        } else if (msg.text.body === '/help' || msg.text.body === '/Help' || msg.text.body === '/ayuda' || msg.text.body === '/Ayuda') {
          await sendTextMessage('txt', msg.from, 'Puedes enviarme un audio para trasnscribir, si escribis resumir, luego del audio te lo entrego resumido... para reiniciar la conversacion ingresa #reiniciar y si me escribis de cualquier tema te puedo ayudar simulando que soy J.A.R.V.I.S. :)');
        } else if (msg.text.body.split("|")[0] === '###ENTRENAR') {
          for (let conversation_ of conversationArray) {
            if (conversation_.conversationId === conversationId) {
              conversation_.conversation.messages.push({ role: "system", content: msg.text.body.split("|")[1] || '' });
              //save conversation to session
              //console.log("LN-141-Entro a personalizar:", conversation_.conversation.messages);
              req.session.conversationArray = conversationArray;
            }
          }
          await sendTextMessage('txt', msg.from, 'Nueva personalidad adquirida...');
        } else if (msg.text.body.split("|")[0] === '###PERSONALIDAD') {
          var conversation_new = {
            messages: [{ role: "system", content: msg.text.body.split("|")[1] || '' }],
            //model: "gpt-3.5-turbo",
            model: "gpt-4o",
          };
          for (let conversation_ of conversationArray) {
            if (conversation_.conversationId === conversationId) {
              conversation_.conversation = conversation_new;
              //save conversation to session
              req.session.conversationArray = conversationArray;
            }
          }
          await sendTextMessage('txt', msg.from, 'Entrenamiento completo...');
        } else if (msg.text.body.toLowerCase().includes('crear') && msg.text.body.toLowerCase().includes('imagen')) {
          const gptResponse = await createImageGPT(msg.text.body);
          await sendTextMessage('img', msg.from, gptResponse);
        }
        else {
          const gptResponse = await chatGPTProcessing(conversationId, req, msg.text.body);
          await sendTextMessage('txt', msg.from, gptResponse.message.content);
        }
      } else if (msg.type === 'image') {
        //console.log("IMAGEN:", JSON.stringify(messages));
        const url = url_whatsapp + msg.image.id;
        //console.log("url:", url);
        try {
          //Llamo al primer metodo para obtener la url de la imagen.
          const media = await axios.get(url, {
            headers: {
              'Authorization': `Bearer ${token_whatsapp}`,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
            }
          });
          const imagen_path = await downloadImage(media);
          const gptResponse = await analyzeImage(imagen_path);
          await sendTextMessage('txt', msg.from, gptResponse.message.content);
          const imageToDelete = `image-${media.data.id}.jpg`;
          //Borro el archivo
          deleteTempFile(imageToDelete);
        } catch (error) {
          await sendTextMessage('txt', msg.from, "Por el momento no podemos procesar imagenes, pero en breve si :) !!");
          console.error('Error:', error);
          req.session.destroy();
          res.sendStatus(404);
        }
      } else {
        //const message = msg.text.body; // Texto del mensaje
        await sendTextMessage('txt', msg.from, "Este es un servicio de transcripcion de audios");
        //console.log(`Message from ${from}: ${message}`);
      }

      // Responder con un 200 para confirmar la recepción del mensaje
      res.sendStatus(200);
    }
  }
});

function findSession(conversationId) {
  return conversationArray.find((conversation) => conversation.conversationId === conversationId);
}

function deleteTempFile(filePath) {
  // Borrar archivo
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error al borrar el archivo:', err);
      return;
    }
    //console.log('Archivo borrado correctamente.');
  });
     
}

// Función para transcribir el archivo de audio utilizando OpenAI
async function transcribeAudio(conversationId, req, audioFilePath) {
  const openai = new OpenAI();
  const conversationArray = req.session.conversationArray;
  for (let conversation_ of conversationArray) {
    if (conversation_.conversationId === conversationId) {
      try {
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioFilePath),
          model: "whisper-1",
        });
        conversation_.conversation.messages.push({ role: "assistant", content: transcription.text });
        //save conversation to session
        req.session.conversationArray = conversationArray;
        //console.log(conversationArray);
        return "TRANSCRIPCION: " + transcription.text;
      } catch (error) {
        throw new Error(error.response ? error.response.data : error.message);
      }
    }
  }

}

async function sendTextMessage(_type, to, text) { 
  const url = url_whatsapp + '423338297528255/messages';
  var data = {
    messaging_product: "whatsapp",
    to: to,
    text: {
      body: text
    }
  };
  if (_type === 'img') {
    // Datos del mensaje que deseas enviar
    data = {
      messaging_product: "whatsapp",
      to: to,
      type: "image",
      image: {
        link: text, /* Only if linking to your media */
        caption: "Imagen Creada..."
      }
    };
  }

  // Configuración del encabezado, incluyendo el token de acceso
  const config = {
    headers: {
      'Authorization': `Bearer ${token_whatsapp}`,
      'Content-Type': 'application/json'
    }
  };
console.log(config);
  // Hacer la solicitud POST usando Axios
  axios.post(url, data, config)
    .then(response => {
      //console.log('Mensaje enviado:', response.data);
    })
    .catch(error => {
      console.error('Error al enviar el mensaje:', error.response ? error.response.data : error.message);
    });

}


async function chatGPTProcessing(conversationId, req, user_text) {
  const openai = new OpenAI();
  const conversationArray = req.session.conversationArray;
  //console.log("Procesa el mensaje: ", JSON.stringify(conversationArray));
  try {
    //console.log('conversationArray:', conversationArray);
    for (let conversation_ of conversationArray) {
      if (conversation_.conversationId === conversationId) {
        conversation_.conversation.messages.push({ role: "user", content: user_text });
        const completion = await openai.chat.completions.create(conversation_.conversation);
        conversation_.conversation.messages.push({ role: "assistant", content: completion.choices[0].message.content });
        //save conversation to session
        req.session.conversationArray = conversationArray;
        return completion.choices[0];
      }
    }
  } catch (error) {
    console.error('Error:', error);
    return { message: { content: 'Lo siento, no puedo procesar esa solicitud.' } };
  }
}

async function createImageGPT(user_text) {
  const openai = new OpenAI();
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: user_text,
      quality: "hd",
      n: 1,
      size: "1792x1024",
    });
    console.log("Imagen: ", response.data[0]);
    return response.data[0].url;
  } catch (error) {
    console.error('Error fetching image:', error);
    //return { message: { content: 'Lo siento, no puedo procesar esa solicitud.' } };
  }
}

// Función para analizar la imagen utilizando la API de OpenAI
async function analyzeImage(imagePath) {
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  //console.log('baseOImage',base64Image);
  const openai = new OpenAI();
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Que hay en la imagen?, si encuentras texto extraelo y clasificalo, lo mismo con los numeros y los colores.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    });
    return response.choices[0];
  } catch (error) {
    console.error('Error fetching image:', error);
    return { message: { content: 'Lo siento, no puedo procesar esa solicitud.' } };
  }
}

// Función para descargar la imagen desde la API de WhatsApp Business
async function downloadImage(media) {
  const config = {
      headers: {
        'Authorization': `Bearer ${token_whatsapp}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
      },
      responseType: 'arraybuffer'
  };

  const response = await axios.get(media.data.url, config);
  const imagePath = `image-${media.data.id}.jpg`;

  fs.writeFileSync(imagePath, response.data);
  return imagePath;
}


const PORT = process.env.PORT2 || 3004;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});