import axios from 'axios';
var config = require('../../config');



export default {
  getRegions() {
    let url =  process.env.BACKEND_URL + '/api/v1/regions';

    return new Promise((resolve, reject) => {
      axios.get(url)
        .then(response => {
          resolve(response.data);
        }, error => {
          console.log(error.request);
          if(!error.request.response) reject('');
          let msg = JSON.parse(error.request.response);
          reject(msg.message);
        });
    });
  }

  
}
