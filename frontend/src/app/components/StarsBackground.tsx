import { useEffect, useState } from 'react';

interface Star {
    id: number;
    x: number;
    y: number;
    size: number;
    opacity: number;
    animationDelay: number;
    animationDuration: number;
}

export default function StarsBackground() {
    const [stars, setStars] = useState<Star[]>([]);

    useEffect(() => {
        // Generate random stars
        const generateStars = () => {
            const starCount = 150; // Number of stars
            const newStars: Star[] = [];

            for (let i = 0; i < starCount; i++) {
                newStars.push({
                    id: i,
                    x: Math.random() * 100, // x position in percentage
                    y: Math.random() * 100, // y position in percentage
                    size: Math.random() * 2 + 1, // size between 1-3px
                    opacity: Math.random() * 0.5 + 0.3, // opacity between 0.3-0.8
                    animationDelay: Math.random() * 3, // delay between 0-3s
                    animationDuration: Math.random() * 2 + 2, // duration between 2-4s
                });
            }

            setStars(newStars);
        };

        generateStars();
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
            {stars.map((star) => (
                <div
                    key={star.id}
                    className="absolute rounded-full bg-white animate-twinkle"
                    style={{
                        left: `${star.x}%`,
                        top: `${star.y}%`,
                        width: `${star.size}px`,
                        height: `${star.size}px`,
                        opacity: star.opacity,
                        animationDelay: `${star.animationDelay}s`,
                        animationDuration: `${star.animationDuration}s`,
                    }}
                />
            ))}

            <style jsx>{`
        @keyframes twinkle {
          0%, 100% {
            opacity: var(--tw-opacity);
            transform: scale(1);
          }
          50% {
            opacity: calc(var(--tw-opacity) * 0.3);
            transform: scale(0.8);
          }
        }
        
        .animate-twinkle {
          animation: twinkle infinite ease-in-out;
        }
      `}</style>
        </div>
    );
}
