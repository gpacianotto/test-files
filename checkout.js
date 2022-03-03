LoadCheckoutPaymentContext(function(Checkout, PaymentOptions) {

	var currentTotalPrice = Checkout.getData('order.cart.prices.total');
	var currencCardBin = null;

	// Some helper functions.

	// Get credit the card number from transparent form.
	var getCardNumber = function() {
		return Checkout.getData('form.cardNumber');
	};

	// Get the first 6 digits from the credit card number.
	var getCardNumberBin = function() {
		return getCardNumber().substring(0, 6);
	};

	// Check whether the BIN (first 6 digits of the credit card number) has changed. If so, we intend to update the available installments.
	var mustRefreshInstallments = function() {
		var cardBin = getCardNumberBin();
		var hasCardBin = cardBin && cardBin.length >= 6;
		var hasPrice = Boolean(Checkout.getData('totalPrice'));
		var changedCardBin = cardBin !== currencCardBin;
		var changedPrice = Checkout.getData('totalPrice') !== currentTotalPrice;
		return (hasCardBin && hasPrice) && (changedCardBin || changedPrice);
	};

	// Update the list of installments available to the consumer.
	var refreshInstallments = function() {
		// Let's imagine the App provides this endpoint to obtain installments.

		Checkout.http.post('https://acmepayments.com/card/installments', {
			amount: Checkout.getData('totalPrice'),
			bin: getCardNumberBin()
		}).then(function(response) {
			Checkout.setInstallments(response.data.installments);
		});
	};

	// Create a new instance of card Payment Option and set its properties.
	var AcmeCardPaymentOption = PaymentOptions.Transparent.CardPayment({

		// Set the option's unique `i`` as it is configured on the Payment Provider so Checkout can relate them.
		id: "ipag_transparent_credit_card",

		// Event handler for form field input.
		onDataChange: Checkout.utils.throttle(function() {
			if (mustRefreshInstallments()) {
				refreshInstallments();
			} else if (!getCardNumberBin()) {
				// Clear installments if customer remove credit card number.
				Checkout.setInstallments(null);
			}
		}),

		onSubmit: function(callback) {
			// Gather the minimum required information.
			var acmeCardRelevantData = {
				orderId: Checkout.getData('order.cart.id'),
				currency: Checkout.getData('order.cart.currency'),
				total: Checkout.getData('order.cart.prices.total'),
				card: {
					number: Checkout.getData('form.cardNumber'),
					name: Checkout.getData('form.cardHolderName'),
					expiration: Checkout.getData('form.cardExpiration'),
					cvv: Checkout.getData('form.cardCvv'),
					installments: Checkout.getData('form.cardInstallments')
				}
			};
			// Let's imagine the App provides this endpoint to process credit card payments.
			Checkout.http.post('https://acmepayments.com/charge', acmeCardRelevantData)
				.then(function(responseBody) {
					if (responseBody.data.success) {
						// If the charge was successful, invoke the callback to indicate you want to close order.
						callback({
							success: true
						});
					} else {
						callback({
							success: false,
							error_code: responseBody.data.error_code
						});

					}
				})
				.catch(function(error) {
					// Handle a potential error in the HTTP request.

					callback({
						success: false,
						error_code: 'unknown_error'
					});
				});
		}
	});

	// Finally, add the Payment Option to the Checkout object so it can be render according to the configuration set on the Payment Provider.
	Checkout.addPaymentOption(AcmeCardPaymentOption);
});
