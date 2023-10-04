import { ObjectId } from "mongodb";
import { Collaboration, Post, User, WebSession } from "./app";
import { ReactionChoice } from "./concepts/reaction";
import { UserDoc } from "./concepts/user";
import { WebSessionDoc } from "./concepts/websession";
import { Router, getExpressRouter } from "./framework/router";
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

  @Router.get("/posts")
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      posts = await Post.getByAuthor(id);
    } else {
      posts = await Post.getPosts({});
    }
    return Responses.posts(posts);
  }

  /**
   * @todo add location parameter and sync with Map concept
   */
  @Router.post("/posts")
  async createPost(session: WebSessionDoc, content: string) {
    const user = WebSession.getUser(session);
    const created = await Post.createSingle(user, content);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:_id")
  async updatePostPiece(session: WebSessionDoc, _id: ObjectId, content: string) {
    const user = WebSession.getUser(session);
    await Post.isAuthorOfPiece(user, _id);
    return await Post.updatePiece(_id, content);
  }

  @Router.delete("/posts/:_id")
  async deletePostPiece(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Post.isAuthorOfPiece(user, _id);
    return Post.deletePiece(new ObjectId(_id));
  }

  @Router.get("/collab")
  async getMyCollaboration(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Collaboration.getCollaborationByUser(user);
  }

  @Router.post("/collab/:_id/contribute")
  async contribute(session: WebSessionDoc, content: string, _id: ObjectId) {
    const user = WebSession.getUser(session);
    const post = await Post.createPiece(user, content);
    const contribution = await Collaboration.contribute(user, post, _id);
    const collaboration = await Collaboration.getCollaborationById(_id);

    // Create a collaborative post if all contributors have submitted their pieces
    if (collaboration.waitingFor.length === 0) {
      const postPieces = await Collaboration.contributionsToItems(collaboration.contributions);
      const collaborativePost = await Post.createPostFromPieces(postPieces);
      await Collaboration.cleanUpCollaboration(_id);

      return { msg: "Collaborative post successfully created!", post: collaborativePost.post };
    }

    return contribution;
  }

  /* eslint-disable */

  /**
   * Retrieves reactions associated with a specific post
   */
  @Router.get("/posts/:_id/reactions")
  async getReactions(_id: ObjectId) {}

  /**
   * Adds or changes reaction to a specific post
   */
  @Router.put("/posts/:_id/reactions")
  async react(session: WebSessionDoc, _id: ObjectId, reactionChoice: ReactionChoice) {}

  /**
   * Removes a reaction from a specific post
   */
  @Router.delete("/posts/_:id/reactions")
  async unReact(session: WebSessionDoc, _id: ObjectId) {}

  /**
   * Retrieves data for a heatmap
   * based on provided latitude, longitude, and zoom level
   */
  @Router.get("/heatmap")
  async getHeatMap(lat: number, long: number, zoom: number) {}

  /**
   * Retrieves nearby posts
   * @todo integrate with @Router.get("/posts")
   */
  @Router.get("/posts/nearby")
  async getNearbyPosts(lat: number, long: number) {}

  /**
   * Retrieves a meeting associated with the authenticated user
   */
  @Router.get("/meetings")
  async getMyMeeting(websession: WebSessionDoc) {}

  /**
   * Ends a specific meeting
   */
  @Router.delete("/meetings/:id")
  async endMeeting(websession: WebSessionDoc, _id: ObjectId) {}

  /**
   * Retrieves nearby meeting requests
   */
  @Router.get("/meetings/requests")
  async getNearbyMeetingRequests(lat: number, long: number) {}

  /**
   * Sends a meeting request with current location
   */
  @Router.post("/meetings/requests")
  async sendMeetingRequest(session: WebSessionDoc, location: Location) {}

  /**
   * Cancels a meeting request by the authenticated user
   */
  @Router.delete("/meetings/requests")
  async removeMeetingRequest(session: WebSessionDoc) {}

  /**
   * Accepts a meeting request from a specific user
   * and provide location
   */
  @Router.put("/meetings/accept/:from")
  async acceptMeetingRequest(session: WebSessionDoc, from: string, location: Location) {}
}

export default getExpressRouter(new Routes());
