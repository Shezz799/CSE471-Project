import { useEffect } from "react";
import Pusher from "pusher-js";
import { useAuth } from "../context/AuthContext";
import toast, { Toaster } from "react-hot-toast";

const OfferNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    const userId = user?._id || user?.id;
    if (!userId) return;

    // Using dummy keys if not in .env, user needs to replace these in their client/.env
    const pusherKey = import.meta.env.VITE_PUSHER_KEY || "dummy_key";
    const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || "mt1";

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    const userChannel = pusher.subscribe(`user-${userId}`);
    userChannel.bind("help:offered", (data) => {
      toast.success(`${data.offerName} ${data.message}`, {
        duration: 5000,
        icon: '👋',
      });
    });

    // Global notifications (for new posts)
    const globalChannel = pusher.subscribe("global");
    globalChannel.bind("post:created", (data) => {
      // Don't notify the user if they were the one who created the post
      if (data.authorId !== userId) {
        toast.success(`${data.authorName} just asked for help on: ${data.subject}`, {
          duration: 5000,
          icon: '📢',
        });
      }
    });

    let adminChannel = null;
    if (user.isDashboardAdmin || user.role === "admin") {
      adminChannel = pusher.subscribe("admin-channel");
      adminChannel.bind("complaint:created", (data) => {
        toast.error(`New Complaint Filed: ${data.category} by ${data.complainantName}`, {
          duration: 6000,
          icon: '🚨',
        });
      });
    }

    return () => {
      userChannel.unbind_all();
      userChannel.unsubscribe();
      globalChannel.unbind_all();
      globalChannel.unsubscribe();
      if (adminChannel) {
        adminChannel.unbind_all();
        adminChannel.unsubscribe();
      }
      pusher.disconnect();
    };
  }, [user]);

  return <Toaster position="top-right" />;
};

export default OfferNotifications;
