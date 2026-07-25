export function sequenceRandom(values: number[]) {
  let index = 0

  return (min: number, max: number) => {
    if (index >= values.length) {
      throw new Error(`random sequence exhausted at ${index}`)
    }

    const value = values[index++]
    if (value < min || value > max) {
      throw new Error(`random value ${value} outside [${min}, ${max}]`)
    }

    return value
  }
}

export function constantRandom(value: number) {
  return (min: number, max: number) => {
    if (value < min || value > max) {
      throw new Error(`random value ${value} outside [${min}, ${max}]`)
    }

    return value
  }
}
