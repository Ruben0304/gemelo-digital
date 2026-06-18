import { WeatherData, WeatherCondition } from '@/types';
import { Sun, CloudSun, Cloud, CloudRain } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface WeatherForecastProps {
  weather: WeatherData;
}

export default function WeatherForecast({ weather }: WeatherForecastProps) {
  const { forecast } = weather;

  // Get weather icon based on condition
  const getWeatherIcon = (condition: WeatherCondition) => {
    const size = 'w-8 h-8';
    switch (condition) {
      case 'sunny':
        return <Sun className={`${size} text-yellow-400`} />;
      case 'partly-cloudy':
        return <CloudSun className={`${size} text-yellow-300`} />;
      case 'cloudy':
        return <Cloud className={`${size} text-gray-400`} />;
      case 'rainy':
        return <CloudRain className={`${size} text-blue-400`} />;
      default:
        return <Sun className={`${size} text-yellow-400`} />;
    }
  };

  // Tomar los próximos 5 días (saltando hoy)
  const upcomingDays = (forecast ?? []).slice(1, 6);

  return (
    <div className="h-full flex flex-col bg-white/30 backdrop-blur-md rounded-3xl p-5">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">Pronóstico extendido</h3>
        <p className="text-[10px] text-gray-500 mt-0.5">Próximos 5 días</p>
      </div>

      {upcomingDays.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-xs text-gray-500">
          Pronóstico no disponible por el momento.
        </div>
      ) : (
      /* Forecast List */
      <div className="flex-1 flex flex-col justify-between space-y-2">
        {upcomingDays.map((day, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-white/25 backdrop-blur-sm rounded-2xl hover:bg-white/35 transition-all duration-200"
          >
            {/* Day name and icon */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {getWeatherIcon(day.condition)}
              </div>
              <div className="flex-shrink-0 min-w-[70px]">
                <div className="text-sm font-semibold text-gray-900">
                  {format(new Date(day.date), 'EEE', { locale: es })}
                </div>
                <div className="text-[10px] text-gray-500">
                  {format(new Date(day.date), 'd MMM', { locale: es })}
                </div>
              </div>
            </div>

            {/* Temperature */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <span className="text-red-500">{day.maxTemp.toFixed(0)}°</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-blue-500">{day.minTemp.toFixed(0)}°</span>
                </div>
              </div>

              {/* Production */}
              <div className="text-right min-w-[60px]">
                <div className="text-sm font-bold text-green-500">
                  {day.predictedProduction.toFixed(0)}
                </div>
                <div className="text-[9px] text-gray-500">kWh</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Footer note */}
      <div className="mt-3 pt-3 border-t border-white/30">
        <p className="text-[9px] text-gray-500 text-center">
          Datos de {weather.provider ?? 'Open-Meteo'}
        </p>
      </div>
    </div>
  );
}
