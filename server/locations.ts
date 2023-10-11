import haversine from "haversine-distance";
import { BadValuesError } from "./concepts/errors";

export interface Location {
  lat: number;
  lng: number;
}

export default class Locations {
  static isValidLocation(location: Location) {
    if (location && typeof location === "object") {
      const { lat, lng } = location;
      if (typeof lat === "number" && typeof lng === "number" && lat <= 90 && lat >= -90 && lng <= 180 && lng >= -180) {
        return;
      }
    }
    throw new BadValuesError(`Invalid location!`);
  }

  static async getCity({ lat, lng }: Location) {
    try {
      const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${process.env.GEOAPIFY_API_KEY}`);
      const json = await response.json();

      return json.features[0].properties.city as string;
    } catch (e) {
      return undefined;
    }
  }

  static getDistance(a: Location, b: Location) {
    return haversine(a, b);
  }

  static compareDistance(origin: Location, a: Location, b: Location) {
    return this.getDistance(origin, a) - this.getDistance(origin, b);
  }

  static getMidLocation(a: Location, b: Location) {
    return {
      lat: (a.lat + b.lat) / 2,
      lng: (a.lng + b.lng) / 2,
    };
  }
}
