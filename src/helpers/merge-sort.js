/**
 * Sorts an array using the merge sort algorithm.
 *
 * @param {any[]} arr - The array to be sorted.
 * @param {(a: any, b: any) => Promise<number>} [comparator] - An optional comparator function that takes two elements and returns a Promise that resolves to a number indicating their relative order.
 * @returns {Promise<any[]>} - A Promise that resolves to the sorted array.
 */
export async function mergeSort(arr, comparator = async (a, b) => a - b) {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = arr.slice(0, mid);
  const right = arr.slice(mid);

  return merge(
    await mergeSort(left, comparator),
    await mergeSort(right, comparator),
    comparator
  );
}

async function merge(left, right, comparator) {
  const result = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if ((await comparator(left[leftIndex], right[rightIndex])) <= 0) {
      result.push(left[leftIndex]);
      leftIndex++;
    } else {
      result.push(right[rightIndex]);
      rightIndex++;
    }
  }

  return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
}

// const A = [1, 2, 3, 4, 5, 6];

// mergeSort(A, async (a, b) => {
//   await new Promise((resolve) => setTimeout(resolve, 1000));
//   console.log([a,b]);
//   return b - a;
// }).then((sorted) => {
//   console.log(sorted);
// });
