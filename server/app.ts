import CollaborationConcept from "./concepts/collaboration";
import MapConcept from "./concepts/map";
import MeetingConcept from "./concepts/meeting";
import PostConcept from "./concepts/post";
import UserConcept from "./concepts/user";
import WebSessionConcept from "./concepts/websession";

// App Definition using concepts
export const WebSession = new WebSessionConcept();
export const User = new UserConcept();
export const Post = new PostConcept();
export const Collaboration = new CollaborationConcept();
export const Meeting = new MeetingConcept();
export const MapPost = new MapConcept("mapPosts");
export const MapMeetingRequest = new MapConcept("mapMeetingRequests");
