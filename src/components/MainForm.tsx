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
      {/* Operator Number - Text Input */}
      <div className="form-field">
        <label htmlFor="operatorNumber" className="form-label">Operator Number</label>
        <input
          type="text"
          className="form-input"
          id="operatorNumber"
          value={operatorName}
          onChange={e => setOperatorName(e.target.value)}
          placeholder="Enter operator number (e.g., 042)"
          disabled={disabled}
        />
      </div>

      {!hideMachine && (
        <div className="form-field">
          <label htmlFor="machine" className="form-label">Machine</label>
          <input
            type="text"
            className="form-input"
            id="machine"
            value={machine}
            readOnly
            disabled={disabled}
          />
        </div>
      )}

      {/* Order Number - Text Input (read from admin or manual entry) */}
      <div className="form-field">
        <label htmlFor="orderNumber" className="form-label">Order Number</label>
        <input
          type="text"
          className="form-input"
          id="orderNumber"
          value={orderNumber}
          onChange={e => setOrderNumber(e.target.value)}
          placeholder="Enter order number"
          disabled={disabled}
        />
      </div>

      {/* Product - Text Input */}
      <div className="form-field">
        <label htmlFor="product" className="form-label">Product</label>
        <input
          type="text"
          className="form-input"
          id="product"
          value={product}
          onChange={e => setProduct(e.target.value)}
          placeholder="Enter product name"
          disabled={disabled}
        />
      </div>

      {/* Batch Number - Text Input */}
      <div className="form-field">
        <label htmlFor="batchNumber" className="form-label">Batch Number</label>
        <input
          type="text"
          className="form-input"
          id="batchNumber"
          value={batchNumber}
          onChange={e => setBatchNumber(e.target.value)}
          placeholder="Enter batch number"
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default MainForm;
