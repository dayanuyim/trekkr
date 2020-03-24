'use strict';
import elevationApi from 'google-elevation-api';
import conf from './data/conf';

// Promisify and Accept only a location
export function googleElevation(lat, lon)
{
  return new Promise((resolve, reject)=>{
    elevationApi({
      key: conf.googleMapKey,
      locations: [
        [lat, lon],
      ]
    }, (err, locations) => {
      if(err) reject(err);
      else resolve(locations[0].elevation);
    });
  });
}
