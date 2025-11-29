import React from 'react';
import { OPERATORS, MACHINES, ORDER_NUMBERS, PRODUCTS, BATCH_NUMBERS } from '../types';

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
  hideMachine?: boolean;
  disabled?: boolean;
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
  hideMachine = false,
  disabled = false,
}) => {
  return (
    <div className="main-form-fields">
      <div className="form-field">
        <label htmlFor="operatorName" className="form-label">Operator Name</label>
        <select 
          className="form-select" 
          id="operatorName" 
          value={operatorName} 
          onChange={e => setOperatorName(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select Operator</option>
          {OPERATORS.map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>
      {!hideMachine && (
        <div className="form-field">
          <label htmlFor="machine" className="form-label">Machine</label>
          <select 
            className="form-select" 
            id="machine" 
            value={machine} 
            onChange={e => setMachine(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select Machine</option>
            {MACHINES.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="form-field">
        <label htmlFor="orderNumber" className="form-label">Order Number</label>
        <select 
          className="form-select" 
          id="orderNumber" 
          value={orderNumber} 
          onChange={e => setOrderNumber(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select Order</option>
          {ORDER_NUMBERS.map(order => (
            <option key={order} value={order}>{order}</option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="product" className="form-label">Product</label>
        <select 
          className="form-select" 
          id="product" 
          value={product} 
          onChange={e => setProduct(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select Product</option>
          {PRODUCTS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="batchNumber" className="form-label">Batch Number</label>
        <select 
          className="form-select" 
          id="batchNumber" 
          value={batchNumber} 
          onChange={e => setBatchNumber(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select Batch</option>
          {BATCH_NUMBERS.map(batch => (
            <option key={batch} value={batch}>{batch}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MainForm;
