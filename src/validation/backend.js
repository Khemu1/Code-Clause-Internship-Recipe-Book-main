import { mixed, object, string } from "yup";


// https://stackoverflow.com/questions/73425133/transform-yup-validation-error-into-a-useable-object

/**
 * Transforms Yup errors into an object.
 * @param {ValidationError} errors - The Yup validation errors.
 * @returns {Record<string, string>} - An object containing the error messages.
 */
export const transformYupErrorsIntoObject = (errors) => {
  const validationErrors = {};

  errors.inner.forEach((error) => {
    if (error.path !== undefined) {
      validationErrors[error.path] = error.errors[0];
    }
  });

  return validationErrors;
};


export const storeRecipe = object({
  title: string().required().label("title"),
  recipe: string().required().label("recipe"),
  thumbnail: mixed().required().label("thumbnail"),
});

export const editRecipe = object({
  id: string().required().label("id"),
  title: string().required().label("title"),
  recipe: string().required().label("recipe"),
  thumbnail: mixed().nullable().label("thumbnail"), 
});
/**
 * Checks the title and recipe fields for errors.
 * @param {String} title
 * @param {String} recipe
 * @param {String} imgType
 * @param {Boolean} edit - Flag to indicate if it's an edit form.
 * @returns {Object} - An object containing error types and messages.
 */
export function errors([title, recipe, imgType = ``], edit = false) {
  const errorMessages = {};

  if (!edit) {
    if (!title.trim().length > 0) {
      errorMessages.title = "Title is required.";
    }

    if (!recipe.trim().length > 0) {
      errorMessages.recipe = "Recipe is required.";
    }
    if (!imgType.trim().length > 0) {
      errorMessages.imgType = "Image is required.";
    }
  }

  if (edit) {
    if (!title.trim().length > 0 && !recipe.trim().length > 0) {
      errorMessages.general = "At least one of title or recipe must be filled.";
    }
  }

  if (imgType.trim().length > 0 && !checkImageType(imgType)) {
    errorMessages.imgType =
      "Invalid image type. Only jpg, jpeg, and png are allowed.";
  }

  return errorMessages;
}