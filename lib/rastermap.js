'use strict';

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
function greatCircleDistance(pointA, pointB){
  const R = 6371e3; // Radius of the earth in m
  let dLat = deg2rad(pointB.lat-pointA.lat);
  let dLon = deg2rad(pointB.lon-pointA.lon);
  let a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(pointA.lat)) * Math.cos(deg2rad(pointB.lat)) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  let d = R * c;
  return d
}

/**
 * RasterMap uses the center-pixel convention.
 */
class RasterMap {

  /**
   * Constructor: allocates the raster image
   * @param {Object} min - bottom left point such as {lat: Number, lon: Number}
   * @param {Object} max - top right point such as {lat: Number, lon: Number}
   * @param {Number} longestPixelSize - number of pixel on the longest side of the image,
   * @param {boolean} alphaToMax - OPTIONAL - puts the alpha channel to 255 if true. Leaves it at zero is false (default: true)
   * whether it's along the S-N axis or the W-E axis
   */
  constructor(min, max, longestPixelSize, alphaToMax=true){
    this._rasterSize = {
      width: null,
      height: null
    };

    this._corners = {
      bottomLeft: min,
      topRight: max,
      bottomRight: {lat: min.lat, lon: max.lon},
      topLeft: {lat: max.lat, lon: min.lon}
    };

    // in meters
    let southToNorthDistance = greatCircleDistance(this._corners.bottomLeft, this._corners.topLeft);
    let westToEastDistance = greatCircleDistance(this._corners.bottomLeft, this._corners.bottomRight);

    this._meterSize = {
      width: westToEastDistance,
      height: southToNorthDistance
    };

    this._angleSize = {
      height: max.lat - min.lat,
      width: max.lon - min.lon
    };

    if(southToNorthDistance > westToEastDistance){
      // portrait image
      this._rasterSize.height = longestPixelSize;
      this._rasterSize.width = Math.ceil(longestPixelSize * (westToEastDistance / southToNorthDistance));
    } else {
      // landscape image
      this._rasterSize.width = longestPixelSize;
      this._rasterSize.height = Math.ceil(longestPixelSize * (southToNorthDistance / westToEastDistance));
    }

    this._anglePerPixel = {
      width: this._angleSize.width / this._rasterSize.width,
      height: this._angleSize.height / this._rasterSize.height,
    };

    this._pixelPerAngle = {
      width:  this._rasterSize.width / this._angleSize.width,
      height: this._rasterSize.height / this._angleSize.height,
    };

    // number of components per pixel = 4 (RGBA)
    this._ncpp = 4;
    this._buffer = new Uint8Array(this._rasterSize.height * this._rasterSize.width * this._ncpp);

    if(alphaToMax){
      for(let i=3; i<this._buffer.length; i+=this._ncpp){
        this._buffer[i] = 255;
      }
    }
  }


  getRasterWidth(){
    return this._rasterSize.width
  }


  getRasterHeight(){
    return this._rasterSize.height
  }

  getRasterData(){
    return this._buffer
  }


  /**
   * Transform a geo position (lat, lon) to a raster position (x, y), as long as this
   * geo position is within the boundaries of this rasterMap.
   * @param {Object} geoPos - geographic point in {lat: Number, lon: number}
   * @param {boolean} nn - round it to the nearest neighbor raster position (default: true)
   * @return {Object} raster position such as {x: Number, y: Number}
   */
  geoPosToRasterPos(geoPos, nn=true){
    if(geoPos.lat <= this._corners.bottomLeft.lat ||
       geoPos.lat >= this._corners.topLeft.lat ||
       geoPos.lon <= this._corners.bottomLeft.lon ||
       geoPos.lon >= this._corners.bottomRight.lon ){
      throw new Error('The geo position is out of bound')
    }

    let x = (geoPos.lon - this._corners.bottomLeft.lon) * this._pixelPerAngle.width;
    let y = this._rasterSize.height - (geoPos.lat - this._corners.bottomLeft.lat) * this._pixelPerAngle.height - 1;

    if(nn){
      x = Math.round(x);
      y = Math.round(y);
    }

    return {x: x, y: y}
  }


  /**
   * Transform a raster position (x, y) into a geo position (lat, lon), as long as this
   * raster position is within the boundaries of this rasterMap.
   * @param {Object} rasterPos - raster position such as {x: Number, y: Number}
   * @return {Object} a geo position such as {lat: Number, lon: number}
   */
  rasterPosToGeoPos(rasterPos){
    if(rasterPos.x < 0 || rasterPos.x >= this._rasterSize.width ||
       rasterPos.y < 0 || rasterPos.y >= this._rasterSize.height){
      throw new Error('The raster position is out of bound')
    }

    let lon = this._corners.bottomLeft.lon + rasterPos.x * this._anglePerPixel.width;
    let lat = this._corners.bottomLeft.lat + (this._rasterSize.height - rasterPos.y - 1) * this._anglePerPixel.height;

    return {
      lat: lat,
      lon: lon
    }
  }


  /**
   * Transform a raster position (x, y) into a the 1D position within the buffer.
   * Note that the position is the position in the buffer of the first component (red)
   * over the 4 (RGBA)
   * @param {Object} rasterPos - raster position such as {x: Number, y: Number}
   * @return {Number} the position in the buffer
   */
  rasterPositionToBufferPosition(rasterPos){
    if(rasterPos.x < 0 || rasterPos.x >= this._rasterSize.width ||
       rasterPos.y < 0 || rasterPos.y >= this._rasterSize.height){
      throw new Error('The raster position is out of bound')
    }

    return (rasterPos.y * this._rasterSize.width + rasterPos.x) * this._ncpp
  }


  /**
   * Set the color at a given raster position
   * @param {Array} color - the color as [r, g, b, a] or as [r, g, b]
   * @param {Object} rasterPosition - raster position such as {x: Number, y: Number}
   */
  setColorRaster(color, rasterPos){
    let pos1D = this.rasterPositionToBufferPosition(rasterPos);

    if(color.length > this._ncpp){
      throw new Error(`The color must contain at most ${this._ncpp} elements.`)
    }

    for(let i=0; i<color.length; i++){
      this._buffer[pos1D + i] = color[i];
    }
  }


  /**
   * Set the color at the given raster position
   * @param {Array} color - the color as [r, g, b, a] or as [r, g, b]
   * @param {Object} geoPos - geographic point in {lat: Number, lon: number}
   */
  setColorGeo(color, geoPos){
    let rasterPos = this.geoPosToRasterPos(geoPos);
    this.setColorRaster(color, rasterPos);
  }


}

var index = ({
  RasterMap,
});

module.exports = index;
//# sourceMappingURL=rastermap.js.map
