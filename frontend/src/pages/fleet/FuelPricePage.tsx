import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fuelPriceService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';

export default function FuelPricePage() {
  const [city, setCity] = useState('coimbatore');

  const { data: singlePrice } = useQuery({
    queryKey: ['fuel-price', city],
    queryFn: () => fuelPriceService.getPrice(city),
    throwOnError: false,
  });

  const { data: bulkPrices } = useQuery({
    queryKey: ['fuel-prices-bulk'],
    queryFn: () => fuelPriceService.getBulkPrices(),
    throwOnError: false,
  });

  const prices = safeArray<any>(bulkPrices?.prices ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fuel Prices</h1>
        <p className="text-gray-500 text-sm mt-1">Current diesel & petrol prices across cities</p>
      </div>

      {/* Selected city card */}
      {singlePrice && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{singlePrice.city} — {singlePrice.date}</h2>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="coimbatore">Coimbatore</option>
              <option value="chennai">Chennai</option>
              <option value="bangalore">Bangalore</option>
              <option value="mumbai">Mumbai</option>
              <option value="delhi">Delhi</option>
              <option value="hyderabad">Hyderabad</option>
              <option value="kolkata">Kolkata</option>
              <option value="pune">Pune</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-6 bg-yellow-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-2">⛽ Diesel</p>
              <p className="text-3xl font-bold text-gray-900">₹{singlePrice.diesel_price}</p>
              <p className="text-xs text-gray-400 mt-1">{singlePrice.unit}</p>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-2">⛽ Petrol</p>
              <p className="text-3xl font-bold text-gray-900">₹{singlePrice.petrol_price}</p>
              <p className="text-xs text-gray-400 mt-1">{singlePrice.unit}</p>
            </div>
          </div>
        </div>
      )}

      {/* All cities */}
      {prices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold mb-4">All Cities</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2">City</th>
                  <th className="text-right px-4 py-2">Diesel (₹/L)</th>
                  <th className="text-right px-4 py-2">Petrol (₹/L)</th>
                  <th className="text-left px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p: any, i: number) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{p.city}</td>
                    <td className="px-4 py-2 text-right">₹{p.diesel_price}</td>
                    <td className="px-4 py-2 text-right">₹{p.petrol_price}</td>
                    <td className="px-4 py-2 text-gray-500">{p.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
