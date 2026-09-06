const Avatar = ({ user }) =>{
  return user?.avatar ? (
    <img
      src={user.avatar}
      alt={user.name}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      style={{
        width: '100%',
        height: '100%',
        objectFit: "cover",
        borderRadius: "50%",
      }}
    />
  ) : (
    (user?.name || "?")[0].toUpperCase()
  );
}

export default Avatar;
