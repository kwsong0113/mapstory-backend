import haversine from "haversine-distance";
import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { Location } from "../types";

export interface MapDoc extends BaseDoc {
  poi: ObjectId;
  location: Location;
}

export default class MapConcept {
  constructor(public readonly name: string) {
    this.name = name;
  }

  public readonly markers = new DocCollection<MapDoc>(this.name);

  /**
   * Adds a point of interest (POI) with its location to the map
   */
  async add(poi: ObjectId, location: Location) {
    await this.markers.createOne({
      poi,
      location,
    });

    return { msg: "Successfully added to map!" };
  }

  async remove(poi: ObjectId) {
    await this.markers.deleteOne({ poi });

    return { msg: "Successfully removed from map!" };
  }

  /**
   * Retrieves markers from the map based on a specified query.
   */
  async getMarkers(query: Filter<MapDoc>) {
    const markers = await this.markers.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return markers;
  }

  /**
   * Finds nearby markers on the map based on a given location
   * and the provided query
   */
  async findNearby(query: Filter<MapDoc>, limit: number, location?: Location) {
    const markers = await this.getMarkers(query);

    // sort markers by the distance from the given location
    // using haversine formula
    if (location) {
      markers.sort((a: MapDoc, b: MapDoc) => haversine(a.location, location) - haversine(b.location, location));
    }

    return markers.slice(0, limit);
  }
}
