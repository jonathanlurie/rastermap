
function deg2rad(deg) {
  return deg * (Math.PI/180)
}

/**
 * Get the distance between two points, each being a pair of latitude and longitude.
 * This methods uses the haversine formula to calculate along the great circle.
 * Source: https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
 *         and https://www.movable-type.co.uk/scripts/latlong.html
 * @param {Object} a - the point a, of form {lat: Number, long: Number}
 * @param {Object} b - the point b, of form {lat: Number, long: Number}
 * @return {Number} distance in meters
 */
export function greatCircleDistance(pointA, pointB){
  const R = 6371e3; // Radius of the earth in m
  let dLat = deg2rad(pointB.lat-pointA.lat)
  let dLon = deg2rad(pointB.lon-pointA.lon)
  let a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(pointA.lat)) * Math.cos(deg2rad(pointB.lat)) *
          Math.sin(dLon/2) * Math.sin(dLon/2)
  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  let d = R * c
  return d
}
