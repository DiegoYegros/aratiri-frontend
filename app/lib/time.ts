const aMinute = 60;
const anHour = aMinute * 60;
const aDay = anHour * 24;

const formatTime = (date: Date) => {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (seconds < aMinute) {
    return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
  }

  const minutes = Math.round(seconds / aMinute);
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }

  return null;
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
};

export const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const relativeTime = formatTime(date);
  if (relativeTime) {
    return relativeTime;
  }
  return formatDate(date);
};
