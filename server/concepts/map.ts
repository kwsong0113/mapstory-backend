import haversine from "haversine-distance";
import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

export interface Location {
  lat: number;
  lng: number;
}

export interface MapDoc extends BaseDoc {
  poi: ObjectId;
  location: Location;
}

export default class MapConcept {
  public readonly points = new DocCollection<MapDoc>("points");

  /**
   * Adds a point of interest (POI) with its location to the map
   */
  async add(poi: ObjectId, location: Location) {
    await this.points.createOne({
      poi,
      location,
    });

    return { msg: "Successfully added to map!" };
  }

  /**
   * Retrieves points from the map based on a specified query.
   */
  async getPoints(query: Filter<MapDoc>) {
    const points = await this.points.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return points;
  }

  /**
   * Finds nearby points on the map based on a given location.
   */
  async findNearby(location: Location, limit: number) {
    const points = await this.getPoints({});

    // sort points by the distance from the given location
    // using haversine formula
    points.sort((a: MapDoc, b: MapDoc) => haversine(a.location, location) - haversine(b.location, location));

    return points.slice(0, limit);
  }
}
