import haversine from "haversine-distance";

export interface Location {
  lat: number;
  lng: number;
}

export default class Locations {
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
