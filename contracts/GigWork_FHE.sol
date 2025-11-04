pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract GigWork_FHE is ZamaEthereumConfig {
    struct Bid {
        address freelancer;
        euint32 encryptedBidAmount;
        uint256 completionTime;
        string portfolioLink;
        uint32 decryptedBidAmount;
        bool isVerified;
    }

    struct Job {
        address employer;
        uint256 budget;
        string description;
        uint256 deadline;
        string[] bidIds;
        bool isActive;
    }

    mapping(string => Job) public jobs;
    mapping(string => Bid) public bids;
    mapping(string => string[]) public jobBids;

    event JobCreated(string indexed jobId, address indexed employer);
    event BidSubmitted(string indexed bidId, string indexed jobId);
    event BidDecrypted(string indexed bidId, uint32 amount);

    constructor() ZamaEthereumConfig() {}

    function createJob(
        string calldata jobId,
        uint256 budget,
        string calldata description,
        uint256 deadline
    ) external {
        require(bytes(jobs[jobId].description).length == 0, "Job exists");
        jobs[jobId] = Job({
            employer: msg.sender,
            budget: budget,
            description: description,
            deadline: deadline,
            bidIds: new string[](0),
            isActive: true
        });
        emit JobCreated(jobId, msg.sender);
    }

    function submitBid(
        string calldata jobId,
        string calldata bidId,
        externalEuint32 encryptedBidAmount,
        bytes calldata inputProof,
        uint256 completionTime,
        string calldata portfolioLink
    ) external {
        require(jobs[jobId].isActive, "Job inactive");
        require(bytes(bids[bidId].portfolioLink).length == 0, "Bid exists");
        require(FHE.isInitialized(FHE.fromExternal(encryptedBidAmount, inputProof)), "Invalid encryption");

        bids[bidId] = Bid({
            freelancer: msg.sender,
            encryptedBidAmount: FHE.fromExternal(encryptedBidAmount, inputProof),
            completionTime: completionTime,
            portfolioLink: portfolioLink,
            decryptedBidAmount: 0,
            isVerified: false
        });

        FHE.allowThis(bids[bidId].encryptedBidAmount);
        FHE.makePubliclyDecryptable(bids[bidId].encryptedBidAmount);

        jobs[jobId].bidIds.push(bidId);
        jobBids[jobId].push(bidId);

        emit BidSubmitted(bidId, jobId);
    }

    function verifyBid(
        string calldata bidId,
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(!bids[bidId].isVerified, "Bid verified");
        require(FHE.isInitialized(bids[bidId].encryptedBidAmount), "Invalid state");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(bids[bidId].encryptedBidAmount);

        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);

        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));
        bids[bidId].decryptedBidAmount = decodedValue;
        bids[bidId].isVerified = true;

        emit BidDecrypted(bidId, decodedValue);
    }

    function getJob(string calldata jobId) external view returns (
        address employer,
        uint256 budget,
        string memory description,
        uint256 deadline,
        bool isActive
    ) {
        Job storage job = jobs[jobId];
        return (job.employer, job.budget, job.description, job.deadline, job.isActive);
    }

    function getBid(string calldata bidId) external view returns (
        address freelancer,
        uint256 completionTime,
        string memory portfolioLink,
        uint32 decryptedBidAmount,
        bool isVerified
    ) {
        Bid storage bid = bids[bidId];
        return (bid.freelancer, bid.completionTime, bid.portfolioLink, bid.decryptedBidAmount, bid.isVerified);
    }

    function getJobBids(string calldata jobId) external view returns (string[] memory) {
        return jobBids[jobId];
    }

    function closeJob(string calldata jobId) external {
        require(jobs[jobId].employer == msg.sender, "Not owner");
        jobs[jobId].isActive = false;
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}


