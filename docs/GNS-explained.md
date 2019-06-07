# How the GNS works with a subgraph

The GNS contract acts as a contract that emits as much information as possible just through events, rather that storing contract data. 

This pattern of development has its advantages and disadvantages. But building a Dapp and connecting it to a subgraph removes some of the disadvantages. Emitting information through events only means that it is much harder to track. But writing a proper subgraph means that the data can be indexed however you like. All it requires is that the mappings be written so that the event data properly represents the latest information that is intended to read. 

The only data that MUST be stored on chain are domains and their owners. This is so it can be controlled which accounts can call the functions that emit the events. `onlyDomainOwner` and `onlyOwner` are used for this. 

Below are a list of the events, and how they are to be indexed by a Subgraph:

`event DomainAdded(bytes32 indexed domainHash, address indexed owner, string domainName);`
- When a domain is added, it is also stored in the smart contract along with the owner. But the domain name is not stored in the smart contract. Thus the subgraph stores the 2 values that are in the contract, and 1 value that is only emitted in the event

`event DomainTransferred(bytes32 indexed domainHash, address indexed newOwner);`
- When a domain is transferred, the owner is updated in the contract, and this is the only value updated in the subgraph

`event SubgraphIdAdded(bytes32 indexed domainHash, bytes32 indexed subdomainHash, bytes32 indexed subdomainSubgraphId, string subdomainName, bytes32 ipfsHash);`
- When a subgraph is connected to a domain, no data on this is stored in the contract
- First the subgraph deals with the hashes. The domain hash is already known, but this event also emits if it is connected to a sub domain. Sub domains are only emitted through events. If the owner is linking a subgraph to the top level domain, then the subdomain gets passed as an empty string. A hashed empty string is equal to `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`.  The subdomain name is also emitted.
- The subgraphID is just emitted as an event. Whatever is the latest subgraphID emitted, that is the subgraph that will be linked to the domain, i.e. it will stop indexing the old subgraph and start indexing the new one.
- The  ipfsHash stores the metadata for the subgraph information that will be displayed in the Dapp. This is only emitted through the event. If it is overwritten, the subgraph will just store the new data. 
- This event can be recalled again and again by the domain owner, effectively resetting the subgraph ID and the metadata associated with any domain. To switch just the subgraphID, or just the metadata, you can call each of their respective events (see below)

`event SubgraphIdChanged(bytes32 indexed domainHash,bytes32 indexed subdomainHash,bytes32 indexed subdomainSubgraphId);`
- This is just to update the subgraphID associated with a domain. Only the event is emitted, and with the new ID the subgraph will start indexing a new subgraph

`event SubgraphIdDeleted(bytes32 indexed domainHash, bytes32 indexed subdomainHash);`
- This just emits an event that indicates which domain is having its subgraph deleted. This will cause the subgraph to store `null` for the subgraph, and it will stop indexing for this domain

`event AccountMetadataChanged(address indexed account, bytes32 indexed ipfsHash);`
- The account used in the Dapp also has metadata associated with it, and it is stored in an IPFS hash that is emitted. The subgraph will store the most recently emitted ipfs hash containing the metadata
- There are two types of accounts - just a basic account and an Organization Account. They each have a schema that indicates what data the IPFS file stores and the format of it. 

`event SubgraphMetadataChanged(bytes32 indexed domainHash, bytes32 indexed subdomainHash, bytes32 indexed ipfsHash);`
- This will just update subgraph metadata, through an event only. The subgraph will always treat the most recently emitted event as the data to store, and therefore display in the Dapp. 