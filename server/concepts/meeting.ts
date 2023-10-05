import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { Location } from "../types";
import { NotAllowedError, NotFoundError } from "./errors";

export interface MeetingDoc extends BaseDoc {
  host: ObjectId;
  guest: ObjectId;
  at: Location;
}

export interface MeetingRequestDoc extends BaseDoc {
  from: ObjectId;
  at: Location;
}

export default class MeetingConcept {
  public readonly meetings = new DocCollection<MeetingDoc>("meeting");
  public readonly meetingRequests = new DocCollection<MeetingRequestDoc>("meetingRequests");

  /**
   * Retrieves meeting requests based on the provided query
   */
  async getRequests(query: Filter<MeetingRequestDoc>) {
    const requests = await this.meetingRequests.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return requests;
  }
  /**
   * Retrieves a meeting request by the specified user
   */
  async getRequestByUserId(user: ObjectId) {
    return await this.meetingRequests.readOne({ from: user });
  }

  /**
   * Retrieves a meeting request by ID
   */
  async getRequestById(_id: ObjectId) {
    const request = await this.meetingRequests.readOne({ _id });
    if (!request) {
      throw new NotFoundError(`Request ${_id} does not exist!`);
    }
    return request;
  }

  /**
   * Sends a meeting request from a user with its location
   */
  async sendRequest(from: ObjectId, at: Location) {
    await this.canRequestOrAccept(from);
    await this.meetingRequests.createOne({ from, at });
    return { msg: "Sent request!" };
  }

  /**
   * Removes a meeting request sent by a user
   */
  async removeRequest(from: ObjectId) {
    await this.meetingRequests.deleteOne({ from });
    return { msg: "Removed request!" };
  }

  /**
   * Accepts a meeting request
   * Creates a new meeting and delete the meeting request
   */
  async acceptRequest(user: ObjectId, location: Location, _id: ObjectId) {
    await this.canRequestOrAccept(user);
    const { from, at } = await this.getRequestById(_id);
    // create a new meeting
    await this.meetings.createOne({
      host: from,
      guest: user,
      at: {
        lat: location.lat + at.lat,
        lng: location.lng + at.lng,
      },
    });
    // remove the request
    await this.removeRequest(_id);
    return {
      msg: "Accepted request!",
      meeting: (await this.meetings.readOne({ _id })) as MeetingDoc,
    };
  }
  /**
   * Ends a meeting.
   */
  async endMeeting(user: ObjectId) {
    const meeting = await this.meetings.popOne({ $or: [{ host: user }, { guest: user }] });
    if (!meeting) {
      throw new MeetingNotFoundError(user);
    }
    return { msg: "Meeting ended!" };
  }

  /**
   * Checks if a user can send a meeting request or accept a request
   */
  async canRequestOrAccept(user: ObjectId) {
    const request = await this.getRequestByUserId(user);
    if (request) {
      throw new MeetingRequestAlreadyExistsError(user);
    }

    const meeting = await this.meetings.readOne({ $or: [{ host: user }, { guest: user }] });
    if (meeting) {
      throw new AlreadyMeetingError(user);
    }
  }
}

export class MeetingRequestAlreadyExistsError extends NotAllowedError {
  constructor(public readonly user: ObjectId) {
    super("Meeting request from {0} already exists!", user);
  }
}

export class AlreadyMeetingError extends NotAllowedError {
  constructor(public readonly user: ObjectId) {
    super("{0} is already involved in a meeting!", user);
  }
}

export class MeetingNotFoundError extends NotFoundError {
  constructor(public readonly user: ObjectId) {
    super("{0} is not involved in a meeting!", user);
  }
}
