const $ = require("meeko");

function entropy(trait_entropy_list) {
  return trait_entropy_list.reduce(
    (initialValue, currentValue) =>
      initialValue - currentValue * Math.log2(currentValue),
    0
  );
}

function informationContent(trait_info_list) {
  return trait_info_list.reduce(
    (initialValue, currentValue) => initialValue - Math.log2(currentValue),
    0
  );
}

function calculateRarity(
  meta_data,
  ranker = true,
  blank_trait = "__undefined"
) {
  let trait_map = {},
    trait_map_stat = {};
  let trait_info_list = [],
    trait_entropy_list = [];

  meta_data.forEach((NFT) => {
    for (let i in NFT) {
      !trait_map[i] && (trait_map[i] = []);
      NFT[i] = NFT[i].trim();
      trait_map[i].push(NFT[i]);
    }
  });

  const trait_list = Object.keys(trait_map);
  meta_data.forEach((NFT) => {
    trait_list.except(Object.keys(NFT)).forEach((missing_trait) => {
      trait_map[missing_trait].push(blank_trait);
    });
  });

  for (let trait in trait_map) {
    trait_map[trait].countAdv().map((x) => {
      !trait_map_stat[trait] && (trait_map_stat[trait] = {});
      trait_map_stat[trait][x.k] = x.w;
      trait_entropy_list.push(x.w);
    });
  }

  if (!ranker) return trait_map_stat;

  meta_data.forEach((i) => {
    trait_info_list.push(
      trait_list.map((x) => {
        return i[x] ? trait_map_stat[x][i[x]] : trait_map_stat[x][blank_trait];
      })
    );
  });

  const total_entropy = entropy(trait_entropy_list);
  let rarity = trait_info_list
    .map((x, i) => {
      return { v: informationContent(x) / total_entropy, tokenId: i };
    })
    .orderBy(["v"], ["desc"]);

  let rankNumber = 0;
  for (let i = 0; i < rarity.length; i++) {
    rankNumber++;
    if (rarity[i].v === rarity[i - 1]?.v) {
      rankNumber--;
    }
    rarity[i].rank = rankNumber;
  }
  return rarity;
}
module.exports = {
  calculateRarity,
  entropy,
  informationContent,
};
