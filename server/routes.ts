import { ObjectId } from "mongodb";
import { Collaboration, HeatMap, MapMeetingRequest, MapPost, Meeting, Post, Reaction, User, WebSession } from "./app";
import { ReactionChoice } from "./concepts/reaction";
import { UserDoc } from "./concepts/user";
import { WebSessionDoc } from "./concepts/websession";
import { Router, getExpressRouter } from "./framework/router";
import Locations, { Location } from "./locations";
import Responses from "./responses";

class Routes {
  @Router.get("/session")
  async getSessionUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await User.getUsers();
  }

  @Router.get("/users/:username")
  async getUser(username: string) {
    return await User.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: WebSessionDoc, username: string, password: string) {
    WebSession.isLoggedOut(session);
    return await User.create(username, password);
  }

  @Router.patch("/users")
  async updateUser(session: WebSessionDoc, update: Partial<UserDoc>) {
    const user = WebSession.getUser(session);
    return await User.update(user, update);
  }

  @Router.delete("/users")
  async deleteUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    WebSession.end(session);
    return await User.delete(user);
  }

  @Router.post("/login")
  async logIn(session: WebSessionDoc, username: string, password: string) {
    const u = await User.authenticate(username, password);
    WebSession.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: WebSessionDoc) {
    WebSession.end(session);
    return { msg: "Logged out!" };
  }

  /**
   * Retrieves nearby post markers (posts + locations)
   * based on optional query parameters such as author, location, and limit.
   */
  @Router.get("/posts")
  async getPostMarkers(author?: string, lat?: number, lng?: number, limit = 100) {
    const location = lat && lng ? { lat, lng } : undefined;
    let markers;

    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      const posts = await Post.getByAuthor(id);
      markers = await MapPost.findNearby({ poi: { $in: posts.map((post) => post._id) } }, limit, location);
    } else {
      markers = await MapPost.findNearby({}, limit, location);
    }

    return Responses.postMarkers(markers);
  }

  /**
   * Creates a single-authored post
   * and also adds the post to the map with the specified location.
   */
  @Router.post("/posts")
  async createPost(session: WebSessionDoc, content: string, location: Location) {
    Locations.isValidLocation(location);
    const user = WebSession.getUser(session);
    const { msg, post } = await Post.createSingle(user, content);

    // add new post to map with its location
    await MapPost.add(post._id, location);

    return { msg, post: await Responses.post(post) };
  }

  /**
   * Updates a specific post piece by its ID
   * Checks if the authenticated user is the author of the post piece
   */
  @Router.patch("/posts/:_id")
  async updatePostPiece(session: WebSessionDoc, _id: ObjectId, content: string) {
    const user = WebSession.getUser(session);
    await Post.isAuthorOfPiece(user, _id);
    return await Post.updatePiece(_id, content);
  }

  /**
   * Deletes a post piece identified by the given ID.
   * If there are no other post pieces remaining in the same post,
   * it also cleans up the parent post itself and removes it from the map.
   */
  @Router.delete("/posts/:_id")
  async deletePostPiece(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Post.isAuthorOfPiece(user, _id);
    const { msg, deletedPostId } = await Post.deletePiece(new ObjectId(_id));

    // if the parent post of post piece is deleted,
    // remove the post from the map
    if (deletedPostId) {
      await MapPost.remove(deletedPostId);
    }

    return { msg };
  }

  /**
   * Retrieves reactions associated with a specific post
   */
  @Router.get("/posts/:_id/reactions")
  async getReactions(_id: ObjectId) {
    await Post.isValidPost(_id);
    return await Responses.reactions(await Reaction.getReactions(_id));
  }

  /**
   * Adds or changes reaction to a specific post
   * Add sentiment data to HeatMap
   */
  @Router.post("/posts/:_id/reactions")
  async react(session: WebSessionDoc, _id: ObjectId, choice: ReactionChoice, location: Location) {
    Locations.isValidLocation(location);
    await Post.isValidPost(_id);
    const user = WebSession.getUser(session);
    const reaction = await Reaction.getReaction(_id, user);
    if (reaction) {
      // Remove sentiment score of previous reaction from HeatMap
      await HeatMap.remove(location, Reaction.getSentiment(reaction.choice));
    }
    const result = await Reaction.react(_id, user, choice);
    // Add sentiment of reaction to HeatMap
    await HeatMap.add(location, Reaction.getSentiment(choice));
    return result;
  }

  /**
   * Removes a reaction from a specific post
   * Remove sentiment data from HeatMap
   */
  @Router.delete("/posts/:_id/reactions")
  async unreact(session: WebSessionDoc, _id: ObjectId, location: Location) {
    Locations.isValidLocation(location);
    await Post.isValidPost(_id);
    const user = WebSession.getUser(session);
    const reaction = await Reaction.getReaction(_id, user);
    if (reaction) {
      // Remove sentiment score of reaction from HeatMap
      await HeatMap.remove(location, Reaction.getSentiment(reaction.choice));
    }
    return await Reaction.unreact(_id, user);
  }

  /**
   * Retrieves a meeting associated with the authenticated user
   */
  @Router.get("/meeting")
  async getMyMeeting(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.meeting(await Meeting.getMeetingByUserId(user));
  }

  /**
   * Ends the meeting that the authenticated user is participating in
   */
  @Router.delete("/meeting")
  async endMyMeeting(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    await Collaboration.cleanUpCollaboration((await Collaboration.getCollaborationByUser(user))._id);
    return await Meeting.endMeeting(user);
  }

  /**
   * Retrieves nearby meeting request markers
   */
  @Router.get("/meeting/requests")
  async getNearbyMeetingRequestMarkers(lat: number, lng: number, limit = 20) {
    const markers = await MapMeetingRequest.findNearby({}, limit, { lat, lng });

    return Responses.meetingRequestMarkers(markers);
  }

  /**
   * Sends a meeting request with current location
   */
  @Router.post("/meeting/requests")
  async sendMeetingRequest(session: WebSessionDoc, location: Location) {
    Locations.isValidLocation(location);
    const user = WebSession.getUser(session);
    const { msg, request } = await Meeting.sendRequest(user, location);

    // add new meeting request marker to map
    await MapMeetingRequest.add(request._id, location);

    return { msg, request: await Responses.meetingRequest(request) };
  }

  /**
   * Cancels a meeting request by the authenticated user
   * and also removes it from the map.
   */
  @Router.delete("/meeting/requests")
  async removeMeetingRequest(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const { msg, removedRequestId } = await Meeting.removeRequest(user);

    // remove the meeting request marker from the map
    await MapMeetingRequest.remove(removedRequestId);

    return { msg };
  }

  /**
   * Accepts a meeting request from a specific user
   * Removes the request itself and its marker from the map
   * Creates a collaboration group for the host and guest of the meeting
   */
  @Router.put("/meeting/accept/:from")
  async acceptMeetingRequest(session: WebSessionDoc, from: string, location: Location) {
    Locations.isValidLocation(location);
    const user = WebSession.getUser(session);
    const host = await User.getUserByUsername(from);
    const request = await Meeting.getRequestByUserId(host._id);

    // remove the meeting request marker from the map
    await MapMeetingRequest.remove(request._id);

    const { msg, meeting } = await Meeting.acceptRequest(user, location, request._id);

    // create collaboration group of two users
    await Collaboration.create([meeting.host, meeting.guest]);

    return { msg, meeting: await Responses.meeting(meeting) };
  }

  /**
   * Retrieves the collaboration associated with the authenticated user
   */
  @Router.get("/collab")
  async getMyCollaboration(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.collaboration(await Collaboration.getCollaborationByUser(user));
  }

  /**
   * Contributes to a collaborative post
   * by creating a new post piece for a specific collaboration.
   * If all contributors have submitted their pieces,
   * creates a collaborative post
   * and clean up collaboration & meeting
   */
  @Router.post("/collab/:_id/contribute")
  async contribute(session: WebSessionDoc, content: string, _id: ObjectId) {
    const user = WebSession.getUser(session);
    const post = await Post.createPiece(user, content);
    const contribution = await Collaboration.contribute(user, post, _id);
    const collaboration = await Collaboration.getCollaborationById(_id);

    // create a collaborative post if all contributors have submitted their pieces
    if (collaboration.waitingFor.length === 0) {
      const postPieces = await Collaboration.contributionsToItems(collaboration.contributions);
      const { post: collaborativePost } = await Post.createPostFromPieces(postPieces);
      const meeting = await Meeting.getMeetingByUserId(user);
      // add the collaborative post to the map
      await MapPost.add(collaborativePost._id, meeting.at);
      // clean up collaboration & meeting
      await Collaboration.cleanUpCollaboration(_id);
      await Meeting.endMeeting(user);

      return { msg: "Collaborative post successfully created!", post: await Responses.post(collaborativePost) };
    }

    return contribution;
  }

  /**
   * Retrieves data for a heatmap
   */
  @Router.get("/heatmap")
  async getHeatMap() {
    return await HeatMap.getDataPoints();
  }
}

export default getExpressRouter(new Routes());
