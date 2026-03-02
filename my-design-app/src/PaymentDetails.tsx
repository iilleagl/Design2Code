import React from 'react';

const PaymentDetails: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-white w-[375px] h-[812px] relative overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center w-full px-8 mt-[54px] mb-8">
        <div className="w-6 h-6 flex items-center justify-center cursor-pointer">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L11 11" stroke="#1D1B23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 1L1 11" stroke="#1D1B23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="flex-grow text-center text-base font-bold text-[#1D1B23]">Payment Details</h1>
      </div>

      {/* Receipt Content */}
      <div className="flex flex-col items-center w-[315px] relative mt-4">
        {/* Success Icon */}
        <div className="relative w-[90px] h-[90px] flex items-center justify-center z-10 mb-[-45px]">
          <div className="absolute w-full h-full rounded-full bg-[#1251D4] opacity-[0.07]"></div>
          <div className="absolute w-[76px] h-[76px] rounded-full bg-[#1251D4] flex items-center justify-center shadow-lg">
             <svg width="22" height="15" viewBox="0 0 22 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 7.5L8.5 13L20 2" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Receipt Card */}
        <div className="w-full bg-white rounded-[20px] shadow-[0px_4px_50px_rgba(0,0,0,0.05)] pt-[65px] pb-8 px-5 flex flex-col items-center">
          <p className="text-[13px] font-medium text-[#9FA2AB] mb-1">Payment Total</p>
          <h2 className="text-[30px] font-bold text-[#1D1B23] mb-8">$12.00</h2>

          <div className="w-full space-y-5">
            <div className="flex justify-between items-center">
              <span className="text-[13px] font-medium text-[#9FA2AB]">Date</span>
              <span className="text-[14px] font-medium text-[#1D1B23]">12 May 2021</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] font-medium text-[#9FA2AB]">Details</span>
              <span className="text-[14px] font-medium text-[#1D1B23]">Netflix</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] font-medium text-[#9FA2AB]">Reference num</span>
              <span className="text-[14px] font-medium text-[#1D1B23] tracking-[0.05em]">A06453826151</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] font-medium text-[#9FA2AB]">Account</span>
              <span className="text-[14px] font-medium text-[#1D1B23]">Mike Wazowsky</span>
            </div>

            <div className="border-t border-dashed border-[#1D1B23] opacity-[0.08] my-4"></div>

            <div className="flex justify-between items-center">
              <span className="text-[13px] font-medium text-[#9FA2AB]">Total Payment</span>
              <span className="text-[14px] font-medium text-[#1D1B23]">$11.00</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] font-medium text-[#9FA2AB]">Admin fee</span>
              <span className="text-[14px] font-medium text-[#1D1B23]">$1.00</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-[13px] font-bold text-[#1D1B23] tracking-[0.03em]">Total</span>
              <span className="text-[14px] font-bold text-[#1251D4]">$12.00</span>
            </div>
          </div>
        </div>

        {/* Scalloped Bottom Edge Simulation */}
        <div className="w-[278px] h-[11px] flex justify-between absolute bottom-[-5px] overflow-hidden">
           {[...Array(10)].map((_, i) => (
             <div key={i} className="w-[22px] h-[22px] rounded-full bg-[#C4C4C4] opacity-100 flex-shrink-0 mx-[-4px]"></div>
           ))}
        </div>
      </div>

      {/* Footer Button */}
      <div className="absolute bottom-[32px] w-[315px]">
        <button className="w-full h-[60px] bg-[#1251D4] rounded-[16px] text-white text-base font-bold shadow-[0px_10px_15px_rgba(18,81,212,0.15)] active:scale-[0.98] transition-transform">
          Back to Homepage
        </button>
      </div>
    </div>
  );
};

export default PaymentDetails;
