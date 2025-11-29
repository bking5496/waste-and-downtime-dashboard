import React, { useState, useEffect } from 'react';
import ShiftInfo from './components/ShiftInfo';
import MainForm from './components/MainForm';
import WasteSection from './components/WasteSection';
import DowntimeSection from './components/DowntimeSection';
import DashboardCharts from './components/DashboardCharts';
import { WasteEntry, DowntimeEntry } from './types';

function App() {
  console.log('App component rendering');
  const [dateTime, setDateTime] = useState(new Date());
  const [shift, setShift] = useState('');

  // State for the main form
  const [operatorName, setOperatorName] = useState('');
  const [machine, setMachine] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [product, setProduct] = useState('');
  const [batchNumber, setBatchNumber] = useState('');

  // State for waste and downtime inputs
  const [waste, setWaste] = useState<number | ''>('');
  const [wasteType, setWasteType] = useState('');
  const [downtime, setDowntime] = useState<number | ''>('');
  const [downtimeReason, setDowntimeReason] = useState('');

  // State for storing submitted entries
  const [wasteEntries, setWasteEntries] = useState<WasteEntry[]>([]);
  const [downtimeEntries, setDowntimeEntries] = useState<DowntimeEntry[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    // Set the shift
    const hours = dateTime.getUTCHours() + 2; // GMT+2
    if (hours >= 6 && hours < 18) {
      setShift('Day');
    } else {
      setShift('Night');
    }

    return () => clearInterval(timer);
  }, [dateTime]);

  const handleWasteSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (waste && wasteType) {
      setWasteEntries([...wasteEntries, { waste: Number(waste), wasteType }]);
      setWaste('');
      setWasteType('');
    }
  };

  const handleDowntimeSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (downtime && downtimeReason) {
      setDowntimeEntries([...downtimeEntries, { downtime: Number(downtime), downtimeReason }]);
      setDowntime('');
      setDowntimeReason('');
    }
  };

  const handleFinalSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // In a real application, you would send this data to a backend.
    // For now, we'll just show an alert and clear the data.
    const finalData = {
      operatorName,
      machine,
      orderNumber,
      product,
      batchNumber,
      shift,
      date: dateTime.toLocaleDateString(),
      wasteEntries,
      downtimeEntries
    };
    alert('Shift data submitted: ' + JSON.stringify(finalData, null, 2));
    // Clear all data
    setOperatorName('');
    setMachine('');
    setOrderNumber('');
    setProduct('');
    setBatchNumber('');
    setWasteEntries([]);
    setDowntimeEntries([]);
  };

  return (
    <div className="container mt-5 mb-5">
      <div className="card shadow">
        <div className="card-header text-center bg-primary text-white">
          <h1>Waste and Downtime Dashboard</h1>
        </div>
        <div className="card-body">
          <form>
            <div className="row">
              <MainForm
                operatorName={operatorName}
                setOperatorName={setOperatorName}
                machine={machine}
                setMachine={setMachine}
                orderNumber={orderNumber}
                setOrderNumber={setOrderNumber}
                product={product}
                setProduct={setProduct}
                batchNumber={batchNumber}
                setBatchNumber={setBatchNumber}
              />
              <ShiftInfo dateTime={dateTime} shift={shift} />
            </div>

            <hr />

            <div className="row">
              <WasteSection
                waste={waste}
                setWaste={setWaste}
                wasteType={wasteType}
                setWasteType={setWasteType}
                handleWasteSubmit={handleWasteSubmit}
                wasteEntries={wasteEntries}
              />
              <DowntimeSection
                downtime={downtime}
                setDowntime={setDowntime}
                downtimeReason={downtimeReason}
                setDowntimeReason={setDowntimeReason}
                handleDowntimeSubmit={handleDowntimeSubmit}
                downtimeEntries={downtimeEntries}
              />
            </div>

            <hr />

            <DashboardCharts wasteEntries={wasteEntries} downtimeEntries={downtimeEntries} />

            <hr />

            <div className="d-grid mt-4">
              <button type="submit" className="btn btn-success btn-lg" onClick={handleFinalSubmit}>Finalize Shift Submission</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
