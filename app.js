const Homey = require('homey');
const fetch = require('node-fetch');
const { macToImei, getTimestamp, createMD5Hash, createMD5HashForSign } = require('./lib/Utils');
const { LIST_URL_V2, COMPANY_ID, APP_KEY } = require('./lib/Constants');

class ScinanApp extends Homey.App {
  async onInit() {
    this.log('Successfully init Scinan version:', Homey.manifest.version);
    //if settings.get is null or blank run this snippet
    if (!this.homey.settings.get('macToImeiMD5')) {
    this.log('starting mactoimei...');   
    const imei = await macToImei();
    this.log('set mactoimei...');   
    const imeiHash = createMD5Hash(imei, true);
    this.log('set imeiHash...');
    this.homey.settings.set('macToImeiMD5', imeiHash);

  }
    //this.log("IMEI MD5 HASH: " + this.homey.settings.get('macToImeiMD5'));
    if (!this.homey.settings.get('u_interval')){this.homey.settings.set('u_interval', 15)}
    this.log('u_interval setting: ' + this.homey.settings.get('u_interval'));
    this.APIv2UpdateInterval();
    this.homey.settings.on('set', (key, value) => {
      this.log('event setting set in app')
      if (key === `APIv2 result_code <> 0` && value === false) {
        this.log('running APIv2 after Event"')

          this.APIv2();
      }
    });

  }
  APIv2UpdateInterval() {
    this.APIv2();
    this.interval = setInterval(async () => {
        await this.APIv2();
      }, Number(this.homey.settings.get('u_interval')) * 60 * 1000); // 15 minutes
    }

 
  // remember to clear the interval when your component unmounts or application closes
  cleanup() {
      clearInterval(this.interval);

  }

  async APIv2() {
      if ((this.homey.settings.get('APIv2 result_code <> 0')) === true) {
          this.log('APIv2 result_code is <> 0 stopping API call');
          
        return;
      }

        const timestamp = getTimestamp();
        const params_list = {
          app_key: APP_KEY,
          company_id: COMPANY_ID,
          imei: this.homey.settings.get('macToImeiMD5'),
          timestamp: timestamp,
          token: this.homey.settings.get('tokenv2'),
        };
  
        // Generate the sign using the utility function from Utils.js
        const sign = createMD5HashForSign(params_list);
        params_list.sign = sign;
  
        try {
          let urlencoded_list = new URLSearchParams();
          for (let [key, value] of Object.entries(params_list)) {
            urlencoded_list.append(key, value);
          }
          urlencoded_list.append("sign", sign);
  
          let requestOptions_list = {
            method: 'POST',
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: urlencoded_list,
            redirect: 'follow',
          };
  
          const response = await fetch(LIST_URL_V2, requestOptions_list);
          this.log('fetching updates')
          if (!response.ok) {
              this.log('Error response:', response);
              if (response.status === 404) {
                this.homey.settings.set('last APIv2 result', JSON.stringify({ result_code: "404", result_data: [] }));
                this.log("last apiv2 response 404: " + this.homey.settings.get('last APIv2 result'));
              }
             

              throw new Error('Error response from API');
            }
            if (response.headers.get('content-type').includes('application/json')) {
              this.log('setting as json')
              const responseData = await response.json();
              this.homey.settings.set('last APIv2 result', JSON.stringify(responseData));
              if (!(responseData.result_code === "0")) {
                this.homey.settings.set('APIv2 result_code <> 0', true);
                this.log('APIv2 result_code is <> 0 stopping further API calls');
              }
          } else {
              this.log('setting as text')
              const responseText = await response.text();
              this.homey.settings.set('last APIv2 result', responseText);
          
          }
            this.log('response status: ' + response.status)
            //this.homey.settings.set('last APIv2 result', response);
            this.log("last apiv2 response: " + JSON.stringify(this.homey.settings.get('last APIv2 result')));

            //if result_code is anything else than 0 make device unavailable
            
          }
          catch (error) {
              this.log(error);
              //throw new Error(error);
              
          }
      }


}

module.exports = ScinanApp;