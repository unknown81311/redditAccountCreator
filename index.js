const puppeteer = require('puppeteer');
const { app, BrowserWindow, ipcMain } = require('electron');

auth = require("./auth.json")
console.log(auth.simplelogin);
let mainWindow;

app.on('ready', async () => {
  mainWindow = new BrowserWindow({
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
    },
    width: 450,
    height: 740,
    resizable: false,
    autoHideMenuBar: true
  });
  mainWindow.loadFile('index.html');

  process.on('uncaughtException', (error) => {
    mainWindow.webContents.send('mainProcessError', error.message);
  });

  // Listen for unhandled promise rejections in the main process
  process.on('unhandledRejection', (error) => {
    mainWindow.webContents.send('mainProcessError', error.message);
  });

  const browser = await puppeteer.launch();//{headless:false}

  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1280,
    deviceScaleFactor: 1,
  });
  await page.goto("https://www.reddit.com/account/register");

  ipcMain.on('submit', async (event) => {
    page.evaluate(()=>document.querySelector("div.Step__content > form").submit())
  });

  ipcMain.on('clickedCoordinates', (event, coordinates) => {
    const { x, y } = coordinates;

    page.mouse.click(x, y);
  });

  await getVideoStream(page, mainWindow.webContents);
});

async function tabToElmID(page, id) {
    let onElm = false;
    do{
      page.keyboard.press('Tab');
      onElm = await page.evaluate((id) => {
        const elm = document.activeElement;
        return elm.id == id;
      },id);
    }while(onElm==false);
}
async function tabToElmTAG(page, tag) {
    let onElm = false;
    do{
      page.keyboard.press('Tab');
      onElm = await page.evaluate((tag) => {
        const elm = document.activeElement;
        return elm.tagName == tag;
      },tag);
    }while(onElm==false);
}
async function getVideoStream(page, webContents) {
  const email = 
  await fetch("https://app.simplelogin.io/api/alias/random/new?hostname=", {
    "headers": {
      "accept": "application/json, text/plain, */*",
      "authentication": auth.simplelogin,
      "content-type": "application/json",
    },
    "body": "{\"note\":\"REDDIT BOT\"}",
    "method": "POST",
  }).then(e=>e.json()).then(e=>e);

  const emailAddr = email.alias;
  if(!emailAddr)
    return mainWindow.webContents.send('mainProcessError', "cant create alias, potentially limit reached?");
  const userName = emailAddr.split("@")[0].slice(0,20);
  const password = Buffer.from(emailAddr + emailAddr).toString('base64');


  await tabToElmID(page, "regEmail");

  await page.keyboard.type(emailAddr);
  page.keyboard.press('Enter');

  await tabToElmID(page, "regUsername");

  await page.keyboard.type(userName);

  page.keyboard.press('Tab');

  await page.keyboard.type(password);
  page.keyboard.press('Enter');

  await tabToElmTAG(page, "IFRAME");
  //page.click("iframe", {x:Math.random()*50,y:Math.random()*50});

  await page.addStyleTag({content: 'div[style*="opacity: 1"]:has(iframe[src^="https://www.google.com/recaptcha/api2"]){width:100%;height:100%;left:0!important;top:0!important}'});
  
  console.log("waiting for captcha")

  //await page.waitForSelector('iframe[src^="https://www.google.com/recaptcha/api2"]');

  setInterval(async(page)=>{
    try{
      //console.log("ss")
      await page.screenshot({'path': './captcha.png', 'clip': {'x': 0, 'y': 0, 'width': 400, 'height': 580}});
      webContents.send("updateImage");
    }catch(e){console.error(e)}
  }, 10, page);
}

