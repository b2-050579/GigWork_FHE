# Confidential Freelance Market

Confidential Freelance Market is a privacy-preserving platform designed for the gig economy, empowering freelancers and employers to engage without compromising sensitive financial information. Leveraging Zama's Fully Homomorphic Encryption (FHE) technology, this marketplace ensures that all bidding and offer data remains encrypted, protecting the negotiation process and enhancing data security.

## The Problem

In the conventional freelance marketplace, bidders often have to submit their financial expectations openly, exposing their offer amounts to all participants. This transparency can lead to unfair negotiations where employers might exploit this information, potentially undervaluing the freelancers' work or skewing competition. The risk of sensitive data exposure, coupled with the lack of a secure method to evaluate candidates based on their offerings, creates a significant privacy gap that can deter both freelancers and employers from utilizing online platforms.

## The Zama FHE Solution

Fully Homomorphic Encryption (FHE) offers a groundbreaking approach by allowing computations to be performed on encrypted data without decryption. This means that sensitive details such as bid amounts can remain hidden while still allowing employers to assess proposals effectively. By utilizing Zama’s fhevm, we can securely process encrypted offer data, ensuring confidentiality while maintaining robust selection logic. This revolutionary capability allows freelancers to represent their value without risk, leading to fairer negotiations and a more balanced marketplace.

## Key Features

- 🔒 **Privacy-Preserving Bids**: All bid information is encrypted, safeguarding freelancers' financial data.
- ⚖️ **Fair Competition**: Employers can filter candidates based on offers without revealing sensitive details.
- 💼 **Flexible Engagement**: Adaptable options for both freelancers and employers to ensure a smooth operational flow.
- 🛠️ **Seamless Interface**: User-friendly design for effortless navigation between offers and task listings.
- 🤝 **Secure Negotiation Environment**: Guarantees confidentiality during all stages of bidding and hiring.

## Technical Architecture & Stack

The Confidential Freelance Market platform is built using the following technology stack:

- **Frontend**: JavaScript, React
- **Backend**: Node.js, Express
- **Database**: MongoDB
- **Core Privacy Engine**: Zama's FHE technologies (fhEVM, Concrete ML)

Zama's FHE technology functions as the backbone of our security architecture, ensuring that sensitive data remains encrypted throughout the bidding process.

## Smart Contract / Core Logic

Here is a simplified snippet that captures the essence of our bidding logic using Zama’s technology and Solidity:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BidMarket {
    struct Bid {
        uint64 encryptedAmount;  // Encrypted bid amount
        address freelancer;       // Address of the freelancer
    }

    mapping(uint256 => Bid) public bids;

    function submitBid(uint256 jobId, uint64 encryptedAmount) public {
        require(bids[jobId].freelancer == address(0), "Bid already submitted.");
        bids[jobId] = Bid(encryptedAmount, msg.sender);
    }
    
    function viewBid(uint256 jobId) public view returns (uint64) {
        return TFHE.decrypt(bids[jobId].encryptedAmount); // Example using TFHE for decryption
    }
}
```
This Solidity contract allows freelancers to submit encrypted bids while maintaining their privacy throughout the bidding process.

## Directory Structure

Below is the directory structure for the Confidential Freelance Market project:

```
ConfidentialFreelanceMarket/
├── contracts/
│   └── BidMarket.sol
├── src/
│   ├── App.js
│   ├── index.js
│   └── components/
│       └── BidForm.js
├── package.json
└── README.md
```

This organization aids in maintaining clarity and efficiency throughout development.

## Installation & Setup

### Prerequisites

To set up the Confidential Freelance Market, ensure you have the following installed:

- Node.js
- npm (Node Package Manager)
- MongoDB

### Steps

1. **Install Dependencies**: Navigate to the project directory and run the following commands:
   ```bash
   npm install
   npm install fhevm
   ```
2. **Set Up MongoDB**: Ensure your MongoDB server is running and properly configured for data storage.

## Build & Run

To build and execute the application, use the following commands:

1. Compile the smart contracts:
   ```bash
   npx hardhat compile
   ```

2. Start the application:
   ```bash
   npm start
   ```

## Acknowledgements

This project is made possible by Zama, whose open-source Fully Homomorphic Encryption primitives enable us to maintain the highest levels of privacy in our application. We are grateful for the pioneering work that allows developers to innovate while prioritizing user confidentiality.

---

Confidential Freelance Market is more than just a transactional platform; it's a revolution in how freelancers and employers interact with privacy and security at the forefront. Join us in reshaping the gig economy with Zama's cutting-edge FHE technology.


