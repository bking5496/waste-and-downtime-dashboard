import React from 'react';

interface MainFormProps {
  operatorName: string;
  setOperatorName: (value: string) => void;
  machine: string;
  setMachine: (value: string) => void;
  orderNumber: string;
  setOrderNumber: (value: string) => void;
  product: string;
  setProduct: (value: string) => void;
  batchNumber: string;
  setBatchNumber: (value: string) => void;
}

const MainForm: React.FC<MainFormProps> = ({
  operatorName,
  setOperatorName,
  machine,
  setMachine,
  orderNumber,
  setOrderNumber,
  product,
  setProduct,
  batchNumber,
  setBatchNumber,
}) => {
  return (
    <div className="col-md-6">
      <div className="mb-3">
        <label htmlFor="operatorName" className="form-label">Operator Name</label>
        <select className="form-select" id="operatorName" value={operatorName} onChange={e => setOperatorName(e.target.value)}>
          <option value="">Select Operator</option>
          <option value="John Doe">John Doe</option>
          <option value="Jane Smith">Jane Smith</option>
        </select>
      </div>
      <div className="mb-3">
        <label htmlFor="machine" className="form-label">Machine</label>
        <select className="form-select" id="machine" value={machine} onChange={e => setMachine(e.target.value)}>
          <option value="">Select Machine</option>
          <option value="Machine A">Machine A</option>
          <option value="Machine B">Machine B</option>
        </select>
      </div>
      <div className="mb-3">
        <label htmlFor="orderNumber" className="form-label">Order Number</label>
        <select className="form-select" id="orderNumber" value={orderNumber} onChange={e => setOrderNumber(e.target.value)}>
          <option value="">Select Order Number</option>
          <option value="ORD-001">ORD-001</option>
          <option value="ORD-002">ORD-002</option>
        </select>
      </div>
      <div className="mb-3">
        <label htmlFor="product" className="form-label">Product</label>
        <select className="form-select" id="product" value={product} onChange={e => setProduct(e.target.value)}>
          <option value="">Select Product</option>
          <option value="Product X">Product X</option>
          <option value="Product Y">Product Y</option>
        </select>
      </div>
      <div className="mb-3">
        <label htmlFor="batchNumber" className="form-label">Powder Batch Number</label>
        <select className="form-select" id="batchNumber" value={batchNumber} onChange={e => setBatchNumber(e.target.value)}>
          <option value="">Select Batch Number</option>
          <option value="BATCH-100">BATCH-100</option>
          <option value="BATCH-101">BATCH-101</option>
        </select>
      </div>
    </div>
  );
};

export default MainForm;
