export function Card({ children, className = '', ...props }) {
  return (
    <div 
      className={`rounded-lg shadow-lg transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
