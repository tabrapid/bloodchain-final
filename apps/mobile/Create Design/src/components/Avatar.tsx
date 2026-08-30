interface Props {
  src?: string;
  name?: string;
  size?: number;
  ring?: string;
}

export default function Avatar({ src, name = 'U', size = 40, ring }: Props) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      flexShrink: 0,
      border: ring ? `2.5px solid ${ring}` : '2px solid rgba(255,255,255,0.2)',
      background: 'linear-gradient(135deg, #D85360 0%, #8E4A75 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: 700,
      color: '#fff',
      letterSpacing: '-0.02em',
    }}>
      {src ? (
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
