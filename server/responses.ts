import { Meeting, Post, User } from "./app";
import { AlreadyContributedError } from "./concepts/collaboration";
import { MapDoc } from "./concepts/map";
import { AlreadyMeetingError, MeetingDoc, MeetingNotFoundError, MeetingRequestAlreadyExistsError, MeetingRequestDoc } from "./concepts/meeting";
import { PostAuthorNotMatchError, PostDoc, PostPieceAuthorNotMatchError } from "./concepts/post";
import { Router } from "./framework/router";

/**
 * This class does useful conversions for the frontend.
 * For example, it converts a {@link PostDoc} into a more readable format for the frontend.
 */
export default class Responses {
  /**
   * Converts a PostDoc into more readable format for the frontend
   * by converting piece IDs into pieces and the author ID into a username.
   */
  static async post(post: PostDoc | null) {
    if (!post) {
      return post;
    }

    return (await this.posts([post]))[0];
  }

  /**
   * Same as {@link post} but for an array of PostDoc.
   */
  static async posts(posts: PostDoc[]) {
    const readablePosts = await Post.convertPieceIdsToPieces(posts);
    const idToUsername = await User.getIdsToUsernames(readablePosts.flatMap((post) => post.pieces.map((piece) => piece.author)));

    return readablePosts.map((post) => ({
      ...post,
      pieces: post.pieces.map((piece) => ({
        ...piece,
        author: idToUsername.get(piece.author.toString()) ?? "DELETED_USER",
      })),
    }));
  }
  /**
   * Converts an array of MapDoc objects representing post markers
   * into more readable format for the frontend
   */
  static async postMarkers(postMarkers: MapDoc[]) {
    const postIds = postMarkers.map((markers) => markers.poi);
    const posts = await Post.idsToPosts(postIds);
    const readablePosts = await this.posts(posts);

    return postMarkers.map(({ location }, idx) => ({
      post: readablePosts[idx],
      location,
    }));
  }

  /**
   * Converts a MeetingRequestDoc into a readable format for the frontend
   */
  static async meetingRequest({ from, at }: MeetingRequestDoc) {
    return { from: (await User.getUserById(from)).username, at };
  }

  /**
   * Converts a MeetingDoc into a readable format for the frontend
   */
  static async meeting({ host, guest, at }: MeetingDoc) {
    const [hostName, guestName] = await User.idsToUsernames([host, guest]);
    return { host: hostName, guest: guestName, at };
  }

  /**
   * Converts an array of MapDoc objects representing meeting request markers
   * into more readable format for the frontend
   */
  static async meetingRequestMarkers(meetingRequestMarkers: MapDoc[]) {
    const readableMarkers = await Meeting.idsToMeetingRequests(meetingRequestMarkers.map((marker) => marker.poi));
    const usernames = await User.idsToUsernames(readableMarkers.map(({ from }) => from));

    return readableMarkers.map(({ at }, idx) => ({
      meetingRequest: {
        from: usernames[idx],
      },
      location: at,
    }));
  }
}

Router.registerError(PostPieceAuthorNotMatchError, async (e) => {
  const username = (await User.getUserById(e.author)).username;
  return e.formatWith(username, e._id);
});

Router.registerError(PostAuthorNotMatchError, async (e) => {
  const username = (await User.getUserById(e.author)).username;
  return e.formatWith(username, e._id);
});

Router.registerError(MeetingRequestAlreadyExistsError, async (e) => {
  const username = (await User.getUserById(e.user)).username;
  return e.formatWith(username);
});

Router.registerError(AlreadyMeetingError, async (e) => {
  const username = (await User.getUserById(e.user)).username;
  return e.formatWith(username);
});

Router.registerError(MeetingNotFoundError, async (e) => {
  const username = (await User.getUserById(e.user)).username;
  return e.formatWith(username);
});

Router.registerError(AlreadyContributedError, async (e) => {
  const username = (await User.getUserById(e.user)).username;
  return e.formatWith(username, e._id);
});
